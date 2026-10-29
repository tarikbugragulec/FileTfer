package main

import (
	"context"
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Create application with options
	err := wails.Run(&options.App{
		Title:            "FileTfer - Modern FTP & SFTP İstemcisi",
		Width:            1280,
		Height:           760,
		MinWidth:         750,
		MinHeight:        460,
		StartHidden:      false,
		WindowStartState: options.Maximised,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 18, G: 19, B: 22, A: 1},
		OnStartup: func(ctx context.Context) {
			app.startup(ctx)
			runtime.WindowShow(ctx)
			runtime.WindowMaximise(ctx)
		},
		OnDomReady: func(ctx context.Context) {
			runtime.WindowShow(ctx)
			runtime.WindowMaximise(ctx)
		},
		Bind: []interface{}{
			app,
		},
		Windows: &windows.Options{
			WebviewIsTransparent:                false,
			WindowIsTranslucent:                 false,
			DisableWindowIcon:                   false,
			WebviewDisableRendererCodeIntegrity: true,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
