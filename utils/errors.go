package utils

import "madcraft.io/madcraft/Struct"

func GenerateErrorPackets(code int, text string) []Struct.JSONResponse {
	err := &Struct.CmdError{
		Code: code,
		Text: text,
	}

	errs := []*Struct.CmdError{}
	errs = append(errs, err)
	packet := Struct.JSONResponse{Struct.CMD_ERROR, errs, nil}
	packets := []Struct.JSONResponse{packet}

	return packets
}
