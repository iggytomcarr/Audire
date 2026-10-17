// Command appicon draws the Audire app icon (the logo's gradient waveform on a dark
// rounded tile) and writes build/appicon.png and build/windows/icon.ico.
//
//	go run ./tools/appicon
//
// Each size is rendered from the shapes directly (with supersampling) rather than
// scaled down from one large image, so small taskbar sizes stay crisp.
package main

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/png"
	"log"
	"math"
	"os"
	"path/filepath"
)

type rgb struct{ r, g, b float64 }

// Waveform shapes in the logo's 172-unit space: centre x, top y, bottom y, radius
var shapes = [][4]float64{
	{10, 86, 86, 9},    // dot
	{48, 46, 126, 10},  // bar
	{87, 12, 160, 10},  // tall bar
	{126, 46, 126, 10}, // bar
	{164, 86, 86, 9},   // dot
}

// The logo's waveform gradient: indigo-300 → indigo-400 → violet-400 → sky-300
var waveStops = []struct {
	at float64
	c  rgb
}{
	{0, rgb{165, 180, 252}},
	{0.35, rgb{129, 140, 248}},
	{0.65, rgb{167, 139, 250}},
	{1, rgb{125, 211, 252}},
}

func lerp(a, b rgb, t float64) rgb {
	return rgb{a.r + (b.r-a.r)*t, a.g + (b.g-a.g)*t, a.b + (b.b-a.b)*t}
}

func waveColour(t float64) rgb {
	t = math.Max(0, math.Min(1, t))
	for i := 1; i < len(waveStops); i++ {
		if t <= waveStops[i].at {
			a, b := waveStops[i-1], waveStops[i]
			return lerp(a.c, b.c, (t-a.at)/(b.at-a.at))
		}
	}
	return waveStops[len(waveStops)-1].c
}

// roundedRectSD is the signed distance to a rounded square centred in the unit tile
func roundedRectSD(x, y, half, radius float64) float64 {
	qx := math.Abs(x) - (half - radius)
	qy := math.Abs(y) - (half - radius)
	outside := math.Hypot(math.Max(qx, 0), math.Max(qy, 0))
	return outside + math.Min(math.Max(qx, qy), 0) - radius
}

// capsuleSD is the signed distance to a vertical capsule (a bar with round ends)
func capsuleSD(x, y, cx, top, bottom, r float64) float64 {
	cy := math.Max(top, math.Min(bottom, y))
	return math.Hypot(x-cx, y-cy) - r
}

func render(size int) *image.NRGBA {
	img := image.NewNRGBA(image.Rect(0, 0, size, size))
	const ss = 4 // supersamples per axis
	s := float64(size)

	// Tile: nearly the full square, Windows 11 style rounding
	half := 0.47
	radius := 0.2
	if size <= 24 {
		half, radius = 0.5, 0.16 // fill the space at tiny sizes
	}

	// Fit the waveform (172×172 units) into the middle of the tile
	scale := 0.62 / 172.0
	if size <= 32 {
		scale = 0.72 / 172.0 // bolder bars when there are few pixels
	}
	for py := 0; py < size; py++ {
		for px := 0; px < size; px++ {
			var tile, wave float64
			var waveCol rgb
			for sy := 0; sy < ss; sy++ {
				for sx := 0; sx < ss; sx++ {
					// sample position in unit space, centred at 0
					x := (float64(px)+(float64(sx)+0.5)/ss)/s - 0.5
					y := (float64(py)+(float64(sy)+0.5)/ss)/s - 0.5
					if roundedRectSD(x, y, half, radius) <= 0 {
						tile++
					}
					// waveform space: 0..172 with the centre at 86
					wx := x/scale + 86
					wy := y/scale + 86
					for _, sh := range shapes {
						if capsuleSD(wx, wy, sh[0]-1, sh[1], sh[2], sh[3]) <= 0 {
							wave++
							waveCol = waveColour((wx + wy) / 344)
							break
						}
					}
				}
			}
			n := float64(ss * ss)
			tileA, waveA := tile/n, wave/n
			if tileA == 0 {
				continue
			}
			// Tile gradient: indigo-950 at the top-left to slate-950 at the bottom-right,
			// with a faint sheen across the top
			fx, fy := float64(px)/s, float64(py)/s
			bg := lerp(rgb{30, 27, 75}, rgb{2, 6, 23}, math.Min(1, (fx+fy)/1.6))
			if fy < 0.5 {
				sheen := 0.07 * (1 - fy/0.5)
				bg = lerp(bg, rgb{255, 255, 255}, sheen)
			}
			c := lerp(bg, waveCol, waveA/math.Max(tileA, 1e-9))
			img.SetNRGBA(px, py, color.NRGBA{uint8(c.r), uint8(c.g), uint8(c.b), uint8(math.Round(tileA * 255))})
		}
	}
	return img
}

func pngBytes(img image.Image) []byte {
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		log.Fatal(err)
	}
	return buf.Bytes()
}

// writeICO stores PNG-compressed images of each size in one .ico file
func writeICO(path string, sizes []int) {
	var images [][]byte
	for _, s := range sizes {
		images = append(images, pngBytes(render(s)))
	}
	var buf bytes.Buffer
	binary.Write(&buf, binary.LittleEndian, [3]uint16{0, 1, uint16(len(sizes))})
	offset := 6 + 16*len(sizes)
	for i, s := range sizes {
		dim := uint8(s)
		if s >= 256 {
			dim = 0 // 0 means 256 in the ICO format
		}
		binary.Write(&buf, binary.LittleEndian, struct {
			W, H, Colours, Reserved uint8
			Planes, BitCount        uint16
			Size, Offset            uint32
		}{dim, dim, 0, 0, 1, 32, uint32(len(images[i])), uint32(offset)})
		offset += len(images[i])
	}
	for _, data := range images {
		buf.Write(data)
	}
	if err := os.WriteFile(path, buf.Bytes(), 0644); err != nil {
		log.Fatal(err)
	}
}

func main() {
	if err := os.MkdirAll(filepath.Join("build", "windows"), 0755); err != nil {
		log.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join("build", "appicon.png"), pngBytes(render(1024)), 0644); err != nil {
		log.Fatal(err)
	}
	writeICO(filepath.Join("build", "windows", "icon.ico"), []int{16, 20, 24, 32, 40, 48, 64, 128, 256})
	log.Println("wrote build/appicon.png and build/windows/icon.ico")
}
