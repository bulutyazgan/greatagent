# Beacon - Emergency Response Coordination

## Setup

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Run: `docker-compose up -d`
3. Database ready at `localhost:5432`

## Connection
```
DATABASE_URL=postgresql://beacon_user:beacon_local_dev@localhost:5432/beacon
```

## Stop
```bash
docker-compose down
```
