# Azure CI/CD cho Healthcare System

Du an nay co 2 workflow GitHub Actions:

- `.github/workflows/azure-backend-app-service.yml`: deploy `backend` len Azure App Service.
- `.github/workflows/azure-frontend-static-web-app.yml`: deploy `web` len Azure Static Web Apps.

Moi lan push len branch `main`, phan nao thay doi thi phan do tu build va deploy.

## 1. Tao tai nguyen tren Azure

Backend:

- Tao Azure App Service chay Node.js 20.
- Runtime nen dung Linux neu co the.
- Startup command: `npm start`.
- Health endpoint sau khi deploy: `https://<backend-app>.azurewebsites.net/api/health`.

Frontend:

- Tao Azure Static Web Apps.
- Chon source la GitHub repository nay, hoac tao thu cong roi lay deployment token.
- Build output cua frontend la `web/dist`.

## 2. Tao GitHub Secrets

Vao GitHub repo -> Settings -> Secrets and variables -> Actions -> Secrets.

Them cac secret sau:

| Secret | Dung cho | Cach lay |
| --- | --- | --- |
| `AZURE_BACKEND_PUBLISH_PROFILE` | Deploy backend | Azure App Service -> Get publish profile, copy toan bo noi dung file `.PublishSettings` |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Deploy frontend | Azure Static Web Apps -> Manage deployment token |

Khong dua `.env` that vao Git.

## 3. Tao GitHub Variables

Vao GitHub repo -> Settings -> Secrets and variables -> Actions -> Variables.

Them cac variable sau:

| Variable | Vi du |
| --- | --- |
| `AZURE_BACKEND_APP_NAME` | `healthcare-api-prod` |
| `VITE_API_URL` | `https://healthcare-api-prod.azurewebsites.net/api` |

`VITE_API_URL` se duoc nhung vao frontend luc build.

## 4. Cau hinh App Settings cho backend tren Azure

Trong Azure App Service -> Environment variables, cau hinh toi thieu:

```env
NODE_ENV=production
MONGODB_URI=<mongodb connection string>
MONGODB_DB_NAME=healthcare_system
JWT_ACCESS_SECRET=<secret manh>
JWT_REFRESH_SECRET=<secret manh khac JWT_ACCESS_SECRET>
JWT_ISSUER=medcare-api
JWT_AUDIENCE=medcare-users
SUPER_ADMIN_USERNAME=superadmin
SUPER_ADMIN_PASSWORD=<mat khau manh>
SUPER_ADMIN_EMAIL=<email admin>
APP_BASE_URL=https://<frontend-static-web-app>.azurestaticapps.net
CORS_ORIGINS=https://<frontend-static-web-app>.azurestaticapps.net
GOOGLE_AUTH_ENABLED=false
SMTP_ENABLED=false
PAYMENT_DEMO_ENABLED=true
MOMO_PERSONAL_QR_ENABLED=false
```

Neu dung Google login, SMTP, Redis, thanh toan hoac AI chatbot thi bat lai cac bien tuong ung theo `backend/.env.example.free-production`.

## 5. Chay deploy

Sau khi da them Secrets/Variables:

```bash
git add .github/workflows AZURE_CICD.md
git commit -m "Add Azure CI/CD workflows"
git push origin main
```

GitHub Actions se tu chay. Co the chay thu cong bang nut `Run workflow` trong tab Actions.
