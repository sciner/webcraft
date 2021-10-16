package server

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"reflect"
	"strings"
	"bytes"
	"errors"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"strconv"
)

type (
	// APIServer ...
	APIServer struct {
		List map[string]interface{}
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
func ReturnError(err interface{}, reqID string, w http.ResponseWriter) {
	if err != nil { //catch
		resp := &JsonRpcErr{"2.0", reqID, &JsonRpcErrBody{-32700, fmt.Sprintf("%v", err)}}
		jData, err := json.Marshal(resp)
		if err == nil {
			log.Print(string(jData))
			w.Header().Set("Content-Type", "application/json")
			w.Write(jData)
		}
	}
}

// Add new service
func (a *APIServer) Add(name string, obj interface{}) {
	if a.List == nil {
		a.List = make(map[string]interface{})
	}
	a.List[strings.ToLower(name)] = obj
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

// ReturnError ...
func (a *APIServer) ReturnError(err interface{}, reqID string, w http.ResponseWriter) {
	if err != nil { // catch
		resp := JSONAPIError{
			"error",
			950,
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

// Handler ...
func (a *APIServer) Handler(w http.ResponseWriter, req *http.Request) bool {
	reqID := ""
	defer func() { // catch or finally
		a.ReturnError(recover(), reqID, w)
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
			a.ReturnError(err, reqID, w)
			return false
		}
	}

	if a.Methods == nil {
		a.Methods = make(map[string]*APIServerMethod)
	}

	// Search pre-reflected method in cache
	if m, ok := a.Methods[req.URL.Path]; ok {
		return a.CallMethod(m, reqID, tParams, w, req)
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
	if a.List[class] != nil {
		b := a.List[class]
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
		a.Methods[req.URL.Path] = &APIServerMethod{
			m: m,
		}
		return a.CallMethod(a.Methods[req.URL.Path], reqID, tParams, w, req)
	} else {
		// log.Print("Method not exists(Golang): ", method)
		a.ReturnError(errors.New("Method not exists"), reqID, w)
		return false
	}
}

// CallMethod ...
func (a *APIServer) CallMethod(method *APIServerMethod, reqID string, tParams interface{}, w http.ResponseWriter, req *http.Request) bool {
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
				a.ReturnError(err, reqID, w)
				return false
			}
		} else {
			result = funcResult[0].Interface()
		}
	}
	if reflect.TypeOf(result).String() == "*image.RGBA" {
		img := result.(*image.RGBA)
		// a.writeJPEG(w, img)
		a.writePNG(w, img)
	} else {
		// operation complete successfully
		jData, err := json.Marshal(result)
		if err == nil {
			w.Header().Set("Content-Type", "application/json")
			w.Write(jData)
		} else {
			a.ReturnError(err, reqID, w)
		}
	}
	return true
}

func (a *APIServer) writePNG(w http.ResponseWriter, img *image.RGBA) {
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

func (a *APIServer) writeJPEG(w http.ResponseWriter, img *image.RGBA) {
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

/*
// Add new service
func (a *APIServer) Add(name string, obj interface{}) {
	if a.List == nil {
		a.List = make(map[string]interface{})
	}
	a.List[name] = obj
	log.Println("Registered new API server,", name)
}

// ReturnError ...
func (a *APIServer) ReturnError(err interface{}, reqID string, w http.ResponseWriter) {
	if err != nil { // catch
		resp := &JsonRpcErr{
			Jsonrpc: "2.0",
			ID:      reqID,
			Error: &JsonRpcErrBody{
				Code:    -32700,
				Message: fmt.Sprintf("%v", err),
			},
		}
		jData, err := json.Marshal(resp)
		if err == nil {
			log.Print(string(jData))
			w.Header().Set("Content-Type", "application/json")
			w.Write(jData)
		}
	}
}

// Handler ...
func (a *APIServer) Handler(w http.ResponseWriter, req *http.Request) bool {
	reqID := ""
	defer func() { // catch or finally
		a.ReturnError(recover(), reqID, w)
	}()
	decoder := json.NewDecoder(req.Body)
	var t JsonRpcReq
	err := decoder.Decode(&t)
	if err != nil {
		log.Print(err)
		a.ReturnError(err, reqID, w)
		return false
	}
	reqID = t.ID
	defer req.Body.Close()
	parsedURL := strings.Split(t.Method, "/")
	log.Println("t.Method", t.Method)
	class := parsedURL[0]
	method := parsedURL[1]
	var result interface{}
	var m reflect.Value
	if a.List[class] != nil {
		log.Println("   Service ... ok")
		b := a.List[class]
		m = reflect.ValueOf(b).MethodByName(method)
		log.Println("   Method ("+method+") ... ", m)
	} else {
		log.Println("   Service ... ERR")
	}
	if m.IsValid() {
		log.Println("-> API:", class+"."+method+"()")
		args := make([]reflect.Value, 0)
		if reflect.ValueOf(t.Params).Kind() == reflect.Map {
			params := t.Params.(map[string]interface{})
			log.Println("   args ... ", params, ", count: ", len(params))
			if len(params) > 0 {
				args = make([]reflect.Value, 1)
				args[0] = reflect.ValueOf(params)
			}
		}
		// Run method
		funcResult := m.Call(args)
		// var methodResult *client.APIResult
		if len(funcResult) > 0 {
			if funcResult[1].Elem().IsValid() {
				err = funcResult[1].Interface().(error)
			} else {
				result = funcResult[0].Interface()
			}
		}
		if err != nil {
			ReturnError(err, reqID, w)
			return false
		}
		resp := &JsonRpcResult{
			ID:      reqID,
			Jsonrpc: "2.0",
			Result:  result, // methodResult,
		}
		// Operation complete successfully
		jData, err := json.Marshal(resp)
		if err == nil {
			w.Header().Set("Content-Type", "application/json")
			w.Write(jData)
		} else {
			a.ReturnError(err, reqID, w)
		}
	} else {
		log.Print("Method not exists(Golang): ", t.Method)
		panic("Method not exists")
	}
	if result != nil {
		return true
	}
	return false
}
*/