package server

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"log"
	"net/http"
	"reflect"
	"strconv"
	"strings"

	"madcraft.io/madcraft/Struct"
)

type (
	// APIServer ...
	APIServer struct {
		List    map[string]interface{}
		Methods map[string]*APIServerMethod
	}
	// JsonRpcErr ...
	JsonRpcErr struct {
		Jsonrpc string          `json:"jsonrpc"`
		ID      string          `json:"id"`
		Error   *JsonRpcErrBody `json:"error"`
	}
	// JsonRpcReq ...
	JsonRpcReq struct {
		Jsonrpc string      `json:"jsonrpc"`
		Method  string      `json:"method"`
		Params  interface{} `json:"params"`
		ID      string      `json:"id"`
		Key     string      `json:"key"`
	}
	// JsonRpcErrBody ...
	JsonRpcErrBody struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	}
	// JsonRpcResult ...
	JsonRpcResult struct {
		ID      string          `json:"id"`      // unique id string
		Jsonrpc string          `json:"jsonrpc"` // version
		Result  interface{}     `json:"result"`
		Error   *JsonRpcErrBody `json:"error"`
	}
)

type (
	// APIServerMethod ...
	APIServerMethod struct {
		m reflect.Value
	}
	// JSONAPIResult ...
	JSONAPIResult struct {
		Data interface{} `json:"data"`
	}
	// JSONAPIError ...
	JSONAPIError struct {
		Status  string `json:"status"`
		Code    int    `json:"code"`
		Message string `json:"message"`
	}
)

// ReturnError ...
func (this *APIServer) ReturnError(err interface{}, reqID string, w http.ResponseWriter, error_code int) {
	if err != nil { // catch
		if error_code == 0 {
			error_code = 950
		}
		resp := JSONAPIError{
			"error",
			error_code,
			fmt.Sprintf("%v", err),
		}
		jData, err := json.Marshal(resp)
		if err == nil {
			// log.Print(string(jData))
			w.Header().Set("Content-Type", "application/json")
			w.Write(jData)
		}
	}
}

// Add new service
func (this *APIServer) Add(name string, obj interface{}) {
	if this.List == nil {
		this.List = make(map[string]interface{})
	}
	this.List[strings.ToLower(name)] = obj
	// перебор всех методов
	t := reflect.TypeOf(obj)
	methods := []string{}
	for i := 0; i < t.NumMethod(); i++ {
		// methodName := t.Method(i).Name
		methods = append(methods, t.Method(i).Name)
		// log.Println("Exist method:", t.Method(i).Name)
	}
	log.Printf("Registered new API server `%s` with methods (%s)", name, strings.Join(methods[:], ", "))
}

// Handler ...
func (this *APIServer) Handler(w http.ResponseWriter, req *http.Request) bool {
	reqID := ""
	defer func() { // catch or finally
		this.ReturnError(recover(), reqID, w, 0)
	}()
	defer req.Body.Close()

	// Decode params
	decoder := json.NewDecoder(req.Body)
	var tParams interface{}
	err := decoder.Decode(&tParams)
	if err != nil {
		if err == io.EOF {
			s := `{}`
			_ = json.Unmarshal([]byte(s), &tParams)
		} else {
			this.ReturnError(err, reqID, w, 0)
			return false
		}
	}

	if this.Methods == nil {
		this.Methods = make(map[string]*APIServerMethod)
	}

	// Search pre-reflected method in cache
	if m, ok := this.Methods[req.URL.Path]; ok {
		return this.CallMethod(m, reqID, tParams, w, req)
	}

	// Reflect new method
	log.Println("Reflect new method", req.URL.Path)

	// Parse URL for decode class and method names
	parsedURL := strings.Split(req.URL.Path, "/")
	// class := strings.Title(parsedURL[2])
	// method := strings.Title(parsedURL[3])
	class := strings.ToLower(parsedURL[2])
	method := parsedURL[3]
	log.Println("   call method", req.URL.Path, class, method)

	// Find class and method is registered
	var m reflect.Value
	if this.List[class] != nil {
		b := this.List[class]
		t := reflect.TypeOf(b)
		// поиск метода по имени без учета регистра
		for i := 0; i < t.NumMethod(); i++ {
			methodName := t.Method(i).Name
			// log.Println("Exist method:", t.Method(i).Name)
			if strings.ToLower(methodName) == strings.ToLower(method) {
				m = reflect.ValueOf(b).MethodByName(methodName)
			}
		}
	} else {
		log.Println("   Service ... Not found")
	}

	if m.IsValid() {
		// Add method to cache
		this.Methods[req.URL.Path] = &APIServerMethod{
			m: m,
		}
		return this.CallMethod(this.Methods[req.URL.Path], reqID, tParams, w, req)
	} else {
		// log.Print("Method not exists(Golang): ", method)
		this.ReturnError(errors.New("Method not exists"), reqID, w, 0)
		return false
	}
}

// CallMethod ...
func (this *APIServer) CallMethod(method *APIServerMethod, reqID string, tParams interface{}, w http.ResponseWriter, req *http.Request) bool {
	// log.Printf("Call API %s, class: %s, method: %s", req.URL.Path, class, method)
	args := make([]reflect.Value, 1)
	args[0] = reflect.ValueOf(req)
	// append params
	if reflect.ValueOf(tParams).Kind() == reflect.Map {
		args = append(args, reflect.ValueOf(tParams))
	}
	// call method
	funcResult := method.m.Call(args)
	var result interface{}
	// check result
	if len(funcResult) > 0 {
		if funcResult[1].Elem().IsValid() {
			err := funcResult[1].Interface().(error)
			if err != nil {
				var error_code int
				switch err.(type) {
				//default:
				//	error_code = 0
				case *Struct.SessionError:
					error_code = 401
				}
				this.ReturnError(err, reqID, w, error_code)
				return false
			}
		} else {
			result = funcResult[0].Interface()
		}
	}
	if reflect.TypeOf(result).String() == "*image.RGBA" {
		img := result.(*image.RGBA)
		// this.writeJPEG(w, img)
		this.writePNG(w, img)
	} else {
		// operation complete successfully
		jData, err := json.Marshal(result)
		if err == nil {
			w.Header().Set("Content-Type", "application/json")
			w.Write(jData)
		} else {
			this.ReturnError(err, reqID, w, 0)
		}
	}
	return true
}

func (this *APIServer) writePNG(w http.ResponseWriter, img *image.RGBA) {
	buffer := new(bytes.Buffer)
	if err := png.Encode(buffer, img); err != nil {
		log.Println("unable to encode image.")
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Content-Length", strconv.Itoa(len(buffer.Bytes())))
	if _, err := w.Write(buffer.Bytes()); err != nil {
		log.Println("unable to write image.")
	}
}

func (this *APIServer) writeJPEG(w http.ResponseWriter, img *image.RGBA) {
	buffer := new(bytes.Buffer)
	if err := jpeg.Encode(buffer, img, nil); err != nil {
		log.Println("unable to encode image.")
	}
	w.Header().Set("Content-Type", "image/jpeg")
	w.Header().Set("Content-Length", strconv.Itoa(len(buffer.Bytes())))
	if _, err := w.Write(buffer.Bytes()); err != nil {
		log.Println("unable to write image.")
	}
}
