//+build darwin

package Type

import (
	"golang.org/x/sys/unix"
	"time"
)

func (this *World) getDirectoryCTime(directory string) time.Time {
	var stat unix.Stat_t
	err := unix.Stat(directory, &stat)
	if err != nil {
		return time.Now()
	}
	ctime := time.Unix(int64(stat.Ctim.Sec), int64(stat.Ctim.Nsec))
	return ctime
}
