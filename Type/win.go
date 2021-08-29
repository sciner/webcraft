//+build windows

package Type

import (
	"os"
	"syscall"
	"time"
)

func (this *World) getDirectoryCTime(directory string) time.Time {
	if finfo, err := os.Stat(directory); err == nil {
		stat_t := finfo.Sys().(*syscall.Win32FileAttributeData)
		t := time.Unix(0, stat_t.CreationTime.Nanoseconds())
		return t
	}
	return time.Now()
}
