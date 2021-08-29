//+build linux

package Type

import (
	"os"
	"syscall"
	"time"
)

func (this *World) getDirectoryCTime(directory string) time.Time {
	if finfo, err := os.Stat(directory); err == nil {
		cTime := finfo.Sys().(*syscall.Stat_t).Ctim
		t := time.Unix(cTime.Sec, cTime.Nsec)
		return t
	}
	return time.Now()
}
