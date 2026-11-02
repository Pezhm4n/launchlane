package main

import (
    "embed"
    "encoding/json"
    "net/http"
    "os"
    "github.com/google/uuid"
)

//go:embed assets/*
var assets embed.FS

func Orders(w http.ResponseWriter, r *http.Request) {
    id := r.URL.Query().Get("invoice")
    if id == "" { id = "7ef4f408-4055-48c4-b972-fdb537fae40a" }
    parsed, err := uuid.Parse(id)
    if err != nil { http.Error(w, "invalid invoice", 400); return }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]interface{}{"total": Total([]Line{{17,3},{8,0},{11,2}}), "invoiceId": parsed.String(), "label": os.Getenv("APP_LABEL")})
}

func main() {
    port := os.Getenv("PORT")
    if port == "" { port = "8000" }
    http.HandleFunc("/orders", Orders)
    http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        file := "assets" + r.URL.Path
        if r.URL.Path == "/" || r.URL.Path == "/orders-view" { file = "assets/index.html" }
        body, err := assets.ReadFile(file)
        if err != nil { http.NotFound(w,r); return }
        if r.URL.Path == "/app.js" { w.Header().Set("Content-Type", "text/javascript") } else { w.Header().Set("Content-Type", "text/html; charset=utf-8") }
        w.Write(body)
    })
    if err := http.ListenAndServe(":"+port,nil); err != nil { panic(err) }
}
