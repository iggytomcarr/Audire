//go:build !(windows && (amd64 || arm64))

package main

func primaryWorkAreaOrigin() (int, int) { return 0, 0 }

func pointOnAMonitor(x, y int) bool { return true }
