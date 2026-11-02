package main

import ("testing"; "net/http/httptest"; "encoding/json")

func TestQuantityAndZero(t *testing.T) {
    if got := Total([]Line{{17,3},{8,0},{11,2}}); got != 73 { t.Fatalf("quantity total: %d",got) }
    if Total(nil) != 0 { t.Fatal("empty invoice") }
}
func TestOriginalAPI(t *testing.T) {
    response := httptest.NewRecorder(); Orders(response,httptest.NewRequest("GET","/orders",nil))
    var payload struct{ Total int; InvoiceID string }
    if response.Code != 200 || json.Unmarshal(response.Body.Bytes(),&payload) != nil || payload.Total != 73 || payload.InvoiceID != "7ef4f408-4055-48c4-b972-fdb537fae40a" { t.Fatal("wrong invoice response") }
}
func TestInvalidInvoice(t *testing.T) {
    response := httptest.NewRecorder(); Orders(response,httptest.NewRequest("GET","/orders?invoice=invalid",nil))
    if response.Code != 400 { t.Fatal("invalid UUID accepted") }
}
