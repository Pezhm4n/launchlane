import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from invoice import invoice_total


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/orders":
            value = {"total": invoice_total([
                {"price": 17, "quantity": 3},
                {"price": 8, "quantity": 0},
                {"price": 11, "quantity": 2},
            ])}
        else:
            value = {"service": "invoice service"}
        data = json.dumps(value).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    HTTPServer(("0.0.0.0", 8000), Handler).serve_forever()
