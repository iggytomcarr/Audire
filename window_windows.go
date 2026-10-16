//go:build windows && (amd64 || arm64)

package main

import (
	"syscall"
	"unsafe"
)

var (
	user32               = syscall.NewLazyDLL("user32.dll")
	procSystemParamsInfo = user32.NewProc("SystemParametersInfoW")
	procMonitorFromPoint = user32.NewProc("MonitorFromPoint")
)

type winRect struct{ Left, Top, Right, Bottom int32 }

// primaryWorkAreaOrigin is the top-left of the primary monitor's work area (excluding the taskbar)
func primaryWorkAreaOrigin() (int, int) {
	const spiGetWorkArea = 0x0030
	var r winRect
	if ok, _, _ := procSystemParamsInfo.Call(spiGetWorkArea, 0, uintptr(unsafe.Pointer(&r)), 0); ok == 0 {
		return 0, 0
	}
	return int(r.Left), int(r.Top)
}

// pointOnAMonitor reports whether a screen point is on any connected monitor
func pointOnAMonitor(x, y int) bool {
	const monitorDefaultToNull = 0
	// POINT is passed by value, packed into one 64-bit register
	pt := uintptr(uint32(int32(x))) | uintptr(uint32(int32(y)))<<32
	monitor, _, _ := procMonitorFromPoint.Call(pt, monitorDefaultToNull)
	return monitor != 0
}
