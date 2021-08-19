package conf

import (
	"encoding/json"
	"log"
	"os"
)

type (
	// ConfigType ...
	ConfigType struct {
		AppCode           string
		AppVersion        string
		ServerIP          string // default server ip address with external interface
		Port              int
		Addr              string
		UseSecureProtocol bool
		APIKey            string
		APIDomain         string
		JSONRPCEndpoint   string
		SSLCertFile       string // fullchain
		SSLKeyFile        string // privkey
		RedisServer       string
	}
)

// Config ...
var Config *ConfigType
var configFilePath string

// Read config from json-file
func Read() {
	pwd, err := os.Getwd()
	if err != nil {
		log.Fatal(err)
	}
	configFilePath = pwd + "/conf.json"
	log.Println("Read config from json-file:", configFilePath)
	file, err := os.Open(configFilePath)
	log.Println("helpers.init()")
	if err != nil {
		log.Fatalln("config file", err.Error())
	}
	defer file.Close()
	Config = &ConfigType{}
	jsonParser := json.NewDecoder(file)
	if err = jsonParser.Decode(Config); err != nil {
		Config = &ConfigType{}
		log.Fatalln("parsing config file", err.Error())
	}
	str, err := json.Marshal(Config)
	if err == nil {
		log.Printf("Config %s", str)
	}
}
