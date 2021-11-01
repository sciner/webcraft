package Type

import (
	// "io/ioutil"
	"os"
)

type (
	WorldCreated struct {
		ID        int64                  `json:"id"`
		GUID      string                 `json:"guid"`
		Generator map[string]interface{} `json:"generator"`
	}
)

func copyFile(in, out string) (int64, error) {
	i, e := os.Open(in)
	if e != nil {
		return 0, e
	}
	defer i.Close()
	o, e := os.Create(out)
	if e != nil {
		return 0, e
	}
	defer o.Close()
	return o.ReadFrom(i)
}
