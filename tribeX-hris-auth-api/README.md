<

## Project setup

AFTRER CLONING
npm install

## SAMPLE USERS

SYTEM ADMIN
johndoedoe@gmail.com

ADMIN
rickgrimes@gmail.com

HR MANAGER
chiarraalteri@gmail.com

EMPLOYEE
ludovicastorti@gmail.com

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

# POSTMAN TESTING

```
POST http://localhost:5000/api/tribeX/auth/v1/login

OUTPUT:
{
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0NmE0OGVjOC1mOTRhLTRjZDEtYjBlYS02YTVhMzVkMjJjYTMiLCJjb21wYW55X2lkIjoiMTg5YjJjOGItNmZhMC00Njg3LWI4ODEtZmE2NTIzZGMzMmIzIiwicm9sZV9pZCI6MSwicm9sZV9uYW1lIjoiSFIiLCJpYXQiOjE3NzIwMTAzMzksImV4cCI6MTc3MjA5NjczOX0.nmUmLz1BriHwE9l9xgC6Upenb2VkdIBnTuCK-0KKe_E"
}

GET http://localhost:5000/api/tribeX/auth/v1/users

HEADER

KEY
Authorization

Bearer Bearer token

OUTPUT:

{
    "message": "Users endpoint working",
    "role": "HR",
    "user": {
        "sub": "46a48ec8-f94a-4cd1-b0ea-6a5a35d22ca3",
        "company_id": "189b2c8b-6fa0-4687-b881-fa6523dc32b3",
        "role_id": 1,
        "role_name": "HR",
        "iat": 1772010339,
        "exp": 1772096739
    }
}



```
