from flask import Flask, jsonify
from invoice import total
app = Flask(__name__)
@app.get("/orders")
def orders():
    return jsonify(total=total([{"price":17,"quantity":3},{"price":8,"quantity":0},{"price":11,"quantity":2}]))
