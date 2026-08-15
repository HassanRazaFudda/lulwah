// scripts/mongo-init.js
//
// Idempotently initializes the single-node MongoDB replica set `rs0`.
//
// Why this exists: order placement runs a multi-document transaction
// (create order → decrement stock → increment discount usage, all-or-nothing —
// see plan.md §8.4). A standalone mongod cannot run transactions at all; it
// throws "Transaction numbers are only allowed on a replica set member or
// mongos". This is called out in plan.md §36.6 as "the single most common
// way this stack breaks in production" — it works by accident in local dev
// if someone ran rs.initiate() by hand once, and then fails the first time
// checkout is exercised on a fresh server. This script removes the "by hand"
// step so it can't be forgotten.
//
// Run by the one-shot `mongo-init` service in both docker-compose.dev.yml and
// docker-compose.yml, which waits for mongo's healthcheck before executing
// this. Safe to run on every `docker compose up` — if the replica set is
// already initialized, this is a no-op and exits 0.

function main() {
  try {
    const status = rs.status();
    print(`[mongo-init] replica set "rs0" already initialized (myState=${status.myState})`);
    return;
  } catch (err) {
    const notInitialized =
      err.codeName === "NotYetInitialized" ||
      /no replset config/i.test(err.message || "") ||
      /NotYetInitialized/i.test(err.message || "");

    if (!notInitialized) {
      throw err;
    }
  }

  print('[mongo-init] initializing replica set "rs0"...');
  const result = rs.initiate({
    _id: "rs0",
    members: [{ _id: 0, host: "mongo:27017" }],
  });
  printjson(result);

  if (result.ok !== 1) {
    quit(1);
  }

  print("[mongo-init] done.");
}

main();
