package wwwserver

import (
	"encoding/json"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
)

type (
	File struct {
		Path          string `json:"-"`
		Buffer        []byte `json:"-"`
		ContentType   string `json:"content_type"`
		ContentLength string `json:"content_length"`
	}
	WWWConfig struct {
		UseCache bool `json:"use_cache"`
	}
	Status struct {
		Memory               int              `json:"memory"`
		MissCache            int              `json:"miss_cache"`
		RequestsCount        int              `json:"requests_count"`
		NotFoundCount        int              `json:"not_found_count"`
		NotReadableCount     int              `json:"not_readable_count"`
		ReturnFromCacheCount int              `json:"return_from_cache_count"`
		Config               *WWWConfig       `json:"config"`
		mu                   *sync.Mutex      `json:"-"`
		Files                map[string]*File `json:"files"`
	}
)

var status *Status
var rDir = regexp.MustCompile(`\/$`)
var contentTypes = map[string]string{
	".bmp":   "image/bmp",
	".css":   "text/css",
	".csv":   "text/csv",
	".js":    "text/javascript",
	".json":  "application/json",
	".otf":   "font/otf",
	".pdf":   "application/pdf",
	".php":   "application/php",
	".svg":   "image/svg+xml",
	".ttf":   "font/ttf",
	".webm":  "video/webm",
	".webp":  "image/webp",
	".woff":  "font/woff",
	".woff2": "font/woff2",
	".xml":   "application/xml",
	".zip":   "application/zip",
}

func init() {
	clearCache()
	status.mu = &sync.Mutex{}
	/*http.HandleFunc("/", wwwroute)
	if err := http.ListenAndServe(":80", nil); err != nil {
		log.Fatal("ListenAndServe: ", err)
	}*/
}

func CreateRoute(config *WWWConfig) func(w http.ResponseWriter, r *http.Request) {

	status.Config = config

	return func(w http.ResponseWriter, r *http.Request) {

		path := ""

		switch {
		case rDir.MatchString(r.URL.Path):
			path = "./www/index.html"
			break
		case r.URL.Path == "/clearcache":
			clearCache()
			b := []byte("\"OK\"")
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Content-Length", strconv.Itoa(len(b)))
			w.WriteHeader(http.StatusOK)
			w.Write(b)
			return
		case r.URL.Path == "/status":
			b, err := json.MarshalIndent(status, "", "  ")
			if err == nil {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Content-Length", strconv.Itoa(len(b)))
				w.WriteHeader(http.StatusOK)
				w.Write(b)
			} else {
				w.WriteHeader(http.StatusInternalServerError)
			}
			return
		default:
			path = "./www" + r.URL.Path
		}

		status.RequestsCount++

		// Absolute file path in file system
		path = makeURLFilePath(path)

		// Check if file in cache
		if _, ok := status.Files[path]; status.Config.UseCache && ok {
			// Send from cache
			status.ReturnFromCacheCount++
			sendFile(w, r, path)
		} else {
			status.MissCache++
			if fileExists(path) {
				// Add new file to cache
				err := addFile(path)
				if err == nil {
					// Send file
					sendFile(w, r, path)
				} else {
					status.NotReadableCount++
					// Return 403
					w.WriteHeader(http.StatusForbidden)
				}
			} else {
				status.NotFoundCount++
				// Return 404
				w.WriteHeader(http.StatusNotFound)
			}
		}

	}

}

func clearCache() {
	status = &Status{
		Files: make(map[string]*File),
	}
}

// Add file to cache
func addFile(path string) error {

	buffer, err := ioutil.ReadFile(path)
	if err != nil {
		log.Println("Return error", err)
		return err
	}

	contentType := http.DetectContentType(buffer)
	extension := strings.ToLower(filepath.Ext(path))

	if contentType == "text/plain; charset=utf-8" {
		if _, ok := contentTypes[extension]; ok {
			contentType = contentTypes[extension]
		}
	}

	file := &File{
		Path:          path,
		Buffer:        buffer,
		ContentType:   contentType,
		ContentLength: strconv.Itoa(len(buffer)),
	}

	// Mutex
	defer status.mu.Unlock()
	status.mu.Lock()

	status.Files[path] = file

	status.Memory += len(buffer)
	log.Printf("Added to cache `%s` (%s)", file.ContentType, path)
	return nil

}

// Send file from cache
func sendFile(w http.ResponseWriter, r *http.Request, path string) {
	file := status.Files[path]
	w.Header().Set("Content-Type", file.ContentType)
	w.Header().Set("Content-Length", file.ContentLength)
	w.WriteHeader(http.StatusOK)
	w.Write(file.Buffer)
}

// Return absolute file path in file system
func makeURLFilePath(path string) string {
	pwd, err := os.Getwd()
	if err != nil {
		log.Println(err)
	}
	path, err = filepath.Abs(pwd + "/" + path)
	if err == nil {
		return path
	}
	return ""
}

// fileExists checks if a file exists and is not a directory before we try using it to prevent further errors.
func fileExists(filename string) bool {
	info, err := os.Stat(filename)
	if os.IsNotExist(err) {
		return false
	}
	return !info.IsDir()
}
