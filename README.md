# Cheapkart backend

Express API using Mongoose and Solace PubSub+ MQTT. Mongoose models explicitly use the lowercase MongoDB collections `products`, `users`, `carts`, and `orders`. Existing products are read from `cheapkart.products`; startup does not generate or overwrite product records.

## Setup

1. Copy `.env.example` to `.env` and set `MONGODB_URI`, a long random `JWT_SECRET`, and Solace MQTT credentials. The MongoDB URI is connected with `dbName: cheapkart`.
2. For first startup, change `ADMIN_PASSWORD` to a strong password. The default credentials are `admin` / `admin`; the admin record is created only if no admin with that username/email exists. The app does not overwrite an existing admin password.
3. Install dependencies yourself with `npm install`, then run `npm run dev` or `npm start`.

## Docker

From the repository root:

```sh
docker build -t cheapkart-backend:local ./backend
docker run --rm --name cheapkart-backend --env-file ./backend/.env -p 5000:5000 cheapkart-backend:local
```

The backend Dockerfile installs production dependencies from the lockfile and runs as a non-root user. Its `.dockerignore` excludes `.env` and `node_modules`; credentials are passed at container runtime with `--env-file`, never copied into the image. For Kubernetes, create a cluster Secret from the local environment file with `kubectl create secret generic cheapkart-backend-env --from-env-file=backend/.env -n <namespace>`, then attach it to the backend Deployment using `envFrom.secretRef`. Treat that Secret as sensitive: restrict RBAC access and enable encryption at rest (or use a managed secret store). Keep `VITE_API_URL` in the frontend build configuration only; it is public and must not contain credentials.

To initialize the existing product catalog to the requested demo values, run `npm run seed:products` once. This intentionally sets each product's stock to 5, distributes sellers evenly, and replaces reviews with two clearly demo reviews per product. It does not create duplicate product documents. Review the demo-review choice before using this catalog with real customers.

## API

- `POST /api/auth/signup` `{name,email,password}`; `POST /api/auth/login` `{email,password}` or admin `{username,password}`.
- `GET /api/auth/profile`, `PUT /api/auth/profile` with optional `{name,address:{street,city,pincode,phone}}`.
- `GET /api/products?gender=men&category=shirt&sort=price_asc`; sort can be `price_asc` or `price_desc`. `GET /api/products/:id` accepts Mongo `_id` or `productId`.
- Signed-in customers can `POST /api/products/:id/notify` when a product is out of stock. Their email is stored with that product and sent through SES after an admin publishes an inventory update that makes stock available.
- `GET /api/cart`; `POST /api/cart` `{productId,quantity}` to set a line quantity (zero removes it), or `{items:[{productId,quantity}]}` to replace all cart lines.
- `POST /api/orders` checks out the cart; optional `{shippingAddress:{street,city,pincode,phone}}`, otherwise profile address is used. `GET /api/orders` lists the signed-in user's orders.
- Admin bearer token: `GET /api/admin/orders`, `PATCH /api/admin/orders/:id/status` `{status}`, `GET /api/admin/inventory`, `PATCH /api/admin/products/:id/stock` `{stock}`.
- `GET /api/health` reports API and Mongo connection status.

Checkout uses a MongoDB transaction so stock changes, order creation, and cart clearing commit together. Atlas must be a replica set (Atlas clusters are). Solace order events are published after commit to `ecommerce/orders/placed`; inventory changes publish to `ecommerce/inventory/updated`. The background subscriber sends customer confirmation, admin order alert, and seller low-stock alerts when stock falls to 1 or reaches 0 through Amazon SES. It also sends restock notices to customers subscribed to out-of-stock items when stock becomes available. Configure `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and a SES verified `SES_FROM_EMAIL`. If SES is missing or a send fails, notification details are printed as mock email records in the server log; restock subscriptions remain saved for retry on a later inventory update. In the SES sandbox, destination email addresses also need to be verified or the account must be moved out of the sandbox.

For product data, the existing 100 documents should include valid `gender`, `category`, and a seller matching the schema enum. The schema allows at most two review entries. Mongoose will not retroactively repair documents already stored with values that violate these enums or add missing seller data; inspect/fix those records in Atlas if needed. Existing documents without a `productId` can still be fetched by `_id`.
