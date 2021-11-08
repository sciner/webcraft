package main

import (
	"mime"

	"madcraft.io/madcraft/Api"
	"madcraft.io/madcraft/Struct"
	"madcraft.io/madcraft/Type"
	"madcraft.io/madcraft/utils"
	"madcraft.io/madcraft/utils/conf"

	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/gorilla/websocket"
)

// User connections manager
var Users Type.PlayerConnMan

var DB = Type.GetGameDatabase(getDir() + "/game.sqlite3")

func getDir() string {
	ex, err := os.Executable()
	if err != nil {
		panic(err)
	}
	exPath := filepath.Dir(ex)
	return exPath
}

func main() {

	conf.Read()

	// DB := Type.GetGameDatabase(getDir() + "/game.sqlite3")
	Type.Worlds.GameDB = DB
	Api.Init(DB, Type.Worlds)

	log.Println("—————————————————————————————————————————————————————————————————————————————————————————————————")
	log.Println("                                       MADCRAFT SERVER RUN                                       ")
	log.Println("—————————————————————————————————————————————————————————————————————————————————————————————————")
	log.Println("    Application .........", conf.Config.AppCode, "ver. "+conf.Config.AppVersion)
	log.Println("    Server IP address ...", conf.Config.ServerIP)
	log.Println("    RPC endpoint ........", conf.Config.JSONRPCEndpoint)
	log.Println("    API URL .............", conf.Config.APIDomain)
	log.Println("    OS ..................", runtime.GOOS)
	log.Println("    LISTEN ADDRESS ......", conf.Config.Addr)
	log.Println("—————————————————————————————————————————————————————————————————————————————————————————————————")

	// User connections manager
	Users = Type.PlayerConnMan{
		Connections: make(map[string]*Type.PlayerConn, 0),
	}

	http.HandleFunc("/ws", homeHandler)
	http.HandleFunc(conf.Config.JSONRPCEndpoint, homeHandler)

	mime.AddExtensionType(".js", "application/javascript; charset=utf-8")
	mime.AddExtensionType(".css", "text/css; charset=utf-8")
	mime.AddExtensionType(".wasm", "application/wasm")

	fileServer := http.StripPrefix("/", http.FileServer(http.Dir("www")))
	http.Handle("/", fileServer)
	/*
		www_config := &wwwserver.WWWConfig{
			UseCache: false,
		}
		http.HandleFunc("/", wwwserver.CreateRoute(www_config))
	*/

	if conf.Config.UseSecureProtocol {
		if err := http.ListenAndServeTLS(conf.Config.Addr, conf.Config.SSLCertFile, conf.Config.SSLKeyFile, nil); err != nil {
			log.Fatal("ListenAndServe:", err)
		}
	} else {
		if err := http.ListenAndServe(conf.Config.Addr, nil); err != nil {
			log.Fatal("ListenAndServe:", err)
		}
	}

}

func homeHandler(w http.ResponseWriter, r *http.Request) {

	w.Header().Set("Connection", "close")
	defer r.Body.Close()

	if strings.Index(r.URL.Path, conf.Config.JSONRPCEndpoint) == 0 {
		// JsonRPC2.0 server
		// Add CORS headers
		if origin := r.Header.Get("Origin"); origin != "" {
			headers := w.Header()
			headers.Add("Access-Control-Allow-Origin", origin)
			headers.Add("Vary", "Origin")
			headers.Add("Vary", "Access-Control-Request-Method")
			headers.Add("Vary", "Access-Control-Request-Headers")
			headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Session-ID, xsrf, X-Language-Locale, X-CC-Api-Key, X-CC-Version, X-CC-Sign, *")
			headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		}
		if r.Method == "OPTIONS" {
			// handle preflight in here
			w.WriteHeader(http.StatusOK)
		} else {
			// log.Printf("JsonRPC2.0 request %s", r.URL.Path)
			Api.Server.Handler(w, r)
		}

	} else if strings.Index(r.URL.Path, "/ws") == 0 {

		ws, err := websocket.Upgrade(w, r, nil, 1024, 1024)
		if _, ok := err.(websocket.HandshakeError); ok {
			http.Error(w, "Not a websocket handshake", 400)
			return
		} else if err != nil {
			// return
		}

		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")

		if r.Method == "OPTIONS" {
			return
		}

		// Read session token
		session_id := ""
		skin := ""
		params, _ := url.ParseQuery(r.URL.RawQuery)
		if len(params["session_id"]) > 0 {
			session_id = params["session_id"][0]
		}
		if len(params["skin"]) > 0 {
			skin = params["skin"][0]
		}
		if len(session_id) == 0 || len(skin) == 0 {
			packets := utils.GenerateErrorPackets(Struct.ERROR_INVALID_SESSION, "Invalid session")
			ws.WriteJSON(packets)
			ws.Close()
		} else {
			Users.Connect(DB, session_id, skin, ws)
		}

	}

}
