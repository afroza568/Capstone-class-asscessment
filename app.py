import json
import os
import threading
from datetime import datetime
from flask import Flask, jsonify, request, render_template

app = Flask(__name__)
DB_FILE = os.path.join(os.path.dirname(__file__), "db.json")
db_lock = threading.Lock()

def load_db():
    with db_lock:
        if not os.path.exists(DB_FILE):
            return {"menu": [], "categories": [], "coupons": [], "orders": []}
        with open(DB_FILE, "r", encoding="utf-8") as f:
            return json.load(f)

def save_db(data):
    with db_lock:
        with open(DB_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

@app.route("/")
def index():
    return render_template("index.html")

# ----------------- MENU APIs -----------------
@app.route("/api/menu", methods=["GET"])
def get_menu():
    db = load_db()
    menu = db.get("menu", [])
    category = request.args.get("category")
    search = request.args.get("search", "").strip().lower()

    if category and category != "All":
        menu = [item for item in menu if item.get("category", "").lower() == category.lower()]

    if search:
        menu = [
            item for item in menu
            if search in item.get("name", "").lower() or search in item.get("description", "").lower()
        ]

    return jsonify({"success": True, "data": menu, "categories": db.get("categories", [])})

@app.route("/api/menu", methods=["POST"])
def add_menu_item():
    data = request.json or {}
    name = data.get("name", "").strip()
    price = data.get("price")
    category = data.get("category", "Fast Food").strip()
    description = data.get("description", "").strip()
    image = data.get("image", "").strip()
    rating = float(data.get("rating", 5.0))

    if not name or price is None:
        return jsonify({"success": False, "message": "Name and valid price are required"}), 400

    try:
        price = float(price)
    except ValueError:
        return jsonify({"success": False, "message": "Invalid price"}), 400

    db = load_db()
    menu = db.get("menu", [])
    new_id = max([item["id"] for item in menu], default=0) + 1

    if not image:
        image = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80"

    new_item = {
        "id": new_id,
        "name": name,
        "category": category,
        "price": round(price, 2),
        "description": description or "Freshly prepared with quality ingredients.",
        "rating": rating,
        "image": image,
        "is_popular": False,
        "complementary": []
    }
    menu.append(new_item)

    # Add category to category list if new
    categories = db.get("categories", [])
    if category not in categories and category != "All":
        categories.append(category)
        db["categories"] = categories

    db["menu"] = menu
    save_db(db)
    return jsonify({"success": True, "data": new_item}), 201

@app.route("/api/menu/<int:item_id>", methods=["PUT"])
def update_menu_item(item_id):
    data = request.json or {}
    db = load_db()
    menu = db.get("menu", [])
    target = next((item for item in menu if item["id"] == item_id), None)

    if not target:
        return jsonify({"success": False, "message": "Item not found"}), 404

    if "name" in data and data["name"].strip():
        target["name"] = data["name"].strip()
    if "price" in data:
        try:
            target["price"] = round(float(data["price"]), 2)
        except ValueError:
            pass
    if "category" in data and data["category"].strip():
        target["category"] = data["category"].strip()
    if "description" in data:
        target["description"] = data["description"].strip()
    if "image" in data and data["image"].strip():
        target["image"] = data["image"].strip()
    if "rating" in data:
        try:
            target["rating"] = float(data["rating"])
        except ValueError:
            pass

    save_db(db)
    return jsonify({"success": True, "data": target})

@app.route("/api/menu/<int:item_id>", methods=["DELETE"])
def delete_menu_item(item_id):
    db = load_db()
    menu = db.get("menu", [])
    new_menu = [item for item in menu if item["id"] != item_id]

    if len(new_menu) == len(menu):
        return jsonify({"success": False, "message": "Item not found"}), 404

    db["menu"] = new_menu
    save_db(db)
    return jsonify({"success": True, "message": "Item deleted successfully"})

# ----------------- COUPONS API -----------------
@app.route("/api/coupons/apply", methods=["POST"])
def apply_coupon():
    data = request.json or {}
    code = data.get("code", "").strip().upper()
    subtotal = float(data.get("subtotal", 0.0))

    db = load_db()
    coupons = db.get("coupons", [])
    coupon = next((c for c in coupons if c["code"].upper() == code), None)

    if not coupon:
        return jsonify({"success": False, "message": "Invalid coupon code"}), 400

    min_spend = coupon.get("min_spend", 0)
    if subtotal < min_spend:
        return jsonify({
            "success": False,
            "message": f"Coupon requires a minimum order of ${min_spend:.2f}"
        }), 400

    discount = 0.0
    if coupon["type"] == "fixed":
        discount = min(coupon["value"], subtotal)
    elif coupon["type"] == "percent":
        discount = round(subtotal * (coupon["value"] / 100.0), 2)

    total = max(0.0, subtotal - discount)
    return jsonify({
        "success": True,
        "coupon_code": coupon["code"],
        "discount": round(discount, 2),
        "total": round(total, 2),
        "message": f"Coupon {coupon['code']} applied successfully!"
    })

# ----------------- ORDERS API -----------------
@app.route("/api/orders", methods=["GET"])
def get_orders():
    db = load_db()
    orders = db.get("orders", [])
    # Return newest first
    sorted_orders = sorted(orders, key=lambda x: x.get("created_at", ""), reverse=True)
    return jsonify({"success": True, "data": sorted_orders})

@app.route("/api/orders/<order_id>", methods=["GET"])
def get_order_tracking(order_id):
    db = load_db()
    orders = db.get("orders", [])
    order = next((o for o in orders if o["id"].upper() == order_id.upper()), None)
    if not order:
        return jsonify({"success": False, "message": "Order not found"}), 404
    return jsonify({"success": True, "data": order})

@app.route("/api/orders", methods=["POST"])
def place_order():
    data = request.json or {}
    items = data.get("items", [])
    if not items:
        return jsonify({"success": False, "message": "Cart is empty"}), 400

    customer_name = data.get("customer_name", "").strip() or "Guest Customer"
    order_type = data.get("order_type", "Dine In")
    payment_method = data.get("payment_method", "Cash")
    coupon_code = data.get("coupon_code", "").strip().upper()

    db = load_db()
    menu_map = {item["id"]: item for item in db.get("menu", [])}

    # Verify and calculate subtotal
    subtotal = 0.0
    processed_items = []
    for item in items:
        item_id = item.get("id")
        qty = int(item.get("quantity", 1))
        if qty <= 0:
            continue
        price = float(item.get("price", 0.0))
        if item_id in menu_map:
            price = float(menu_map[item_id]["price"])
            name = menu_map[item_id]["name"]
        else:
            name = item.get("name", f"Item #{item_id}")

        item_total = price * qty
        subtotal += item_total
        processed_items.append({
            "id": item_id,
            "name": name,
            "price": price,
            "quantity": qty,
            "variant": item.get("variant", "Regular")
        })

    subtotal = round(subtotal, 2)
    discount = 0.0

    # Calculate coupon if provided
    if coupon_code:
        coupon = next((c for c in db.get("coupons", []) if c["code"].upper() == coupon_code), None)
        if coupon and subtotal >= coupon.get("min_spend", 0):
            if coupon["type"] == "fixed":
                discount = min(coupon["value"], subtotal)
            elif coupon["type"] == "percent":
                discount = round(subtotal * (coupon["value"] / 100.0), 2)

    total = max(0.0, round(subtotal - discount, 2))

    orders = db.get("orders", [])
    order_number = len(orders) + 1001
    order_id = f"ORD-{order_number}"

    new_order = {
        "id": order_id,
        "customer_name": customer_name,
        "order_type": order_type,
        "payment_method": payment_method,
        "items": processed_items,
        "subtotal": subtotal,
        "discount": discount,
        "coupon_code": coupon_code if discount > 0 else "",
        "total": total,
        "status": "Preparing",
        "created_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    }

    orders.append(new_order)
    db["orders"] = orders
    save_db(db)

    return jsonify({"success": True, "data": new_order, "message": "Order placed successfully!"}), 201

@app.route("/api/orders/<order_id>/status", methods=["PATCH"])
def update_order_status(order_id):
    data = request.json or {}
    new_status = data.get("status")
    valid_statuses = ["Pending", "Preparing", "Ready", "Completed", "Cancelled"]

    if new_status not in valid_statuses:
        return jsonify({"success": False, "message": f"Status must be one of {valid_statuses}"}), 400

    db = load_db()
    orders = db.get("orders", [])
    order = next((o for o in orders if o["id"].upper() == order_id.upper()), None)

    if not order:
        return jsonify({"success": False, "message": "Order not found"}), 404

    order["status"] = new_status
    save_db(db)
    return jsonify({"success": True, "data": order, "message": f"Status updated to {new_status}"})

# ----------------- REPORTS API -----------------
@app.route("/api/reports/daily", methods=["GET"])
def daily_sales_report():
    db = load_db()
    orders = db.get("orders", [])
    today_str = datetime.now().strftime("%Y-%m-%d")

    total_orders_today = 0
    total_revenue_today = 0.0
    all_time_revenue = 0.0

    order_types = {"Dine In": 0, "Pick Up": 0, "Delivery": 0}
    payment_methods = {"Cash": 0, "Debit/Card": 0, "E-Wallet": 0}
    item_sales = {}

    for order in orders:
        tot = float(order.get("total", 0.0))
        all_time_revenue += tot
        
        # Count types and payments
        otype = order.get("order_type", "Dine In")
        order_types[otype] = order_types.get(otype, 0) + 1
        
        pmethod = order.get("payment_method", "Cash")
        payment_methods[pmethod] = payment_methods.get(pmethod, 0) + 1

        # Check if today
        created = order.get("created_at", "")
        if created.startswith(today_str):
            total_orders_today += 1
            total_revenue_today += tot

        # Track item quantities
        for item in order.get("items", []):
            name = item.get("name")
            qty = item.get("quantity", 1)
            item_sales[name] = item_sales.get(name, 0) + qty

    # Sort popular items
    popular_items = sorted(item_sales.items(), key=lambda x: x[1], reverse=True)[:5]
    popular_list = [{"name": name, "quantity": qty} for name, qty in popular_items]

    return jsonify({
        "success": True,
        "date": today_str,
        "total_orders_today": total_orders_today,
        "total_revenue_today": round(total_revenue_today, 2),
        "total_orders_all_time": len(orders),
        "total_revenue_all_time": round(all_time_revenue, 2),
        "order_types": order_types,
        "payment_methods": payment_methods,
        "top_selling_items": popular_list
    })

# ----------------- RECOMMENDATIONS (BONUS) -----------------
@app.route("/api/recommendations", methods=["GET"])
def get_recommendations():
    cart_ids = request.args.get("cart", "")
    cart_id_list = []
    if cart_ids:
        try:
            cart_id_list = [int(i.strip()) for i in cart_ids.split(",") if i.strip()]
        except ValueError:
            cart_id_list = []

    db = load_db()
    menu = db.get("menu", [])
    menu_dict = {item["id"]: item for item in menu}

    recommended_ids = set()

    # Find complementary items for items in cart
    for cid in cart_id_list:
        if cid in menu_dict:
            for comp_id in menu_dict[cid].get("complementary", []):
                if comp_id not in cart_id_list and comp_id in menu_dict:
                    recommended_ids.add(comp_id)

    # If no specific complementary items found or cart is empty, suggest popular items
    if not recommended_ids:
        for item in menu:
            if item.get("is_popular") and item["id"] not in cart_id_list:
                recommended_ids.add(item["id"])

    # Fallback to top rated items if needed
    if not recommended_ids:
        for item in sorted(menu, key=lambda x: x.get("rating", 0), reverse=True):
            if item["id"] not in cart_id_list:
                recommended_ids.add(item["id"])
                if len(recommended_ids) >= 3:
                    break

    recommendations = [menu_dict[i] for i in recommended_ids if i in menu_dict][:4]
    return jsonify({
        "success": True,
        "recommendations": recommendations,
        "reason": "Complementary with your cart items" if cart_id_list and any(
            cid in menu_dict and menu_dict[cid].get("complementary") for cid in cart_id_list
        ) else "Popular Chef Favorites"
    })

if __name__ == "__main__":
    print("Grill Restaurant system running on http://127.0.0.1:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
