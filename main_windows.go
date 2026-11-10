package main

import (
	"embed"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"
	"unsafe"
)

const appPort = "8769"
const appHost = "localhost:" + appPort
const appURL = "http://" + appHost + "/"

//go:embed docs
var webFiles embed.FS

func main() {
	serveOnly := flag.Bool("serve", false, "serve the editor for a regular browser tab")
	flag.Parse()
	if err := run(*serveOnly); err != nil {
		fmt.Fprintln(os.Stderr, err)
		if !*serveOnly {
			showError(err)
		}
		os.Exit(1)
	}
}

func run(serveOnly bool) error {
	site, err := fs.Sub(webFiles, "docs")
	if err != nil {
		return err
	}
	files := http.FileServer(http.FS(site))
	server := &http.Server{
		ReadHeaderTimeout: 5 * time.Second,
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Host != appHost {
				http.Error(w, "Open OpenWootility at "+appURL, http.StatusBadRequest)
				return
			}
			w.Header().Set("Cache-Control", "no-cache")
			w.Header().Set("Content-Security-Policy", "frame-ancestors 'none'")
			files.ServeHTTP(w, r)
		}),
	}

	listener, err := net.Listen("tcp4", "127.0.0.1:"+appPort)
	if err != nil {
		return fmt.Errorf("could not open %s. Close any other OpenWootility window or local Wootility launcher and try again: %w", appURL, err)
	}
	defer server.Close()
	fmt.Println("OpenWootility is available at " + appURL)

	if serveOnly {
		return server.Serve(listener)
	}

	go server.Serve(listener)
	return openAppWindow()
}

func openAppWindow() error {
	edge, err := findEdge()
	if err != nil {
		return err
	}
	cache, err := os.UserCacheDir()
	if err != nil {
		return err
	}
	profile := filepath.Join(cache, "OpenWootility", "Edge")
	command := exec.Command(edge, "--app="+appURL, "--user-data-dir="+profile,
		"--no-first-run", "--disable-background-mode")
	if err := command.Run(); err != nil {
		return fmt.Errorf("could not open the Microsoft Edge app window: %w", err)
	}
	return nil
}

func findEdge() (string, error) {
	for _, name := range []string{"ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA"} {
		base := os.Getenv(name)
		if base == "" {
			continue
		}
		candidate := filepath.Join(base, "Microsoft", "Edge", "Application", "msedge.exe")
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return candidate, nil
		}
	}
	return "", errors.New("Microsoft Edge is required to open the desktop window. You can use the web version in Chrome.")
}

func showError(err error) {
	message, _ := syscall.UTF16PtrFromString(err.Error())
	title, _ := syscall.UTF16PtrFromString("OpenWootility")
	box := syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW")
	box.Call(0, uintptr(unsafe.Pointer(message)), uintptr(unsafe.Pointer(title)), 0x10)
}
