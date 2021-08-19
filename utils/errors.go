package utils

import "whiteframe.ru/webcraft/Struct"

func GenerateErrorPackets(code int, text string) []Struct.JSONResponse {
	err := &Struct.CmdError{
		Code: code,
		Text: text,
	}

	errs := []*Struct.CmdError{}
	errs = append(errs, err)
	packet := Struct.JSONResponse{Struct.COMMAND_ERROR, errs, nil}
	packets := []Struct.JSONResponse{packet}

	return packets
}
