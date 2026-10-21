# Controlled Node service

This is an intentionally small test workload for Launchlane. `npm start` runs it
without a build or external dependencies. Supply `PORT` and `WELCOME_MESSAGE` on
the server. Values never appear in its response or logs.

`GET /healthz` reports process liveness. `GET /` returns HTTP 500 with
`CONFIG_REQUIRED` when `WELCOME_MESSAGE` is missing, and HTTP 200 with the
`sample-v1` revision when it is present. Liveness alone cannot demonstrate a
successful deployment or a fixed incident. Tests run this known sample locally;
they do not establish Liara deployment or real-model diagnosis quality.
