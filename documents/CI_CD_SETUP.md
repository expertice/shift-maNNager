# 🚀 Руководство по настройке CI/CD

Это краткое руководство поможет вам настроить и запустить CI/CD pipeline для проекта Shift Manager.

## 📋 Содержание

- [Что уже настроено](#что-уже-настроено)
- [Быстрый старт](#быстрый-старт)
- [Настройка GitHub Secrets](#настройка-github-secrets)
- [Как работает Pipeline](#как-работает-pipeline)
- [Деплой на сервер](#деплой-на-сервер)
- [Troubleshooting](#troubleshooting)

---

## ✅ Что уже настроено

В репозитории уже созданы:

1. **GitHub Actions Workflow** (`.github/workflows/ci-cd.yml`)
   - Автоматический запуск при push/PR в `master` и `develop`
   - 8 этапов: Lint → Type Check → Tests → Build → Docker → Security → Deploy

2. **Шаблоны для разработки**
   - Pull Request template
   - Issue templates (Bug Report, Feature Request)
   - CONTRIBUTING.md с правилами разработки

3. **Конфигурация**
   - `.gitattributes` для правильной обработки line endings
   - Обновленный README с полной документацией

---

## 🚀 Быстрый старт

### 1. Проверка что CI/CD работает

После push изменений на GitHub:

1. Откройте ваш репозиторий: https://github.com/expertice/shift-maNNager
2. Перейдите во вкладку **Actions**
3. Вы увидите запущенный workflow "CI/CD Pipeline"
4. Кликните на него чтобы увидеть прогресс

### 2. Просмотр статуса

В README.md уже есть badges для отображения статуса:

```markdown
![Build Status](https://github.com/expertice/shift-maNNager/actions/workflows/ci-cd.yml/badge.svg)
```

Вы можете добавить их в начало README если нужно.

---

## 🔐 Настройка GitHub Secrets

Для полноценной работы CI/CD настройте secrets в репозитории.

### Шаги:

1. Откройте репозиторий на GitHub
2. **Settings** → **Secrets and variables** → **Actions**
3. Нажмите **New repository secret**

### Обязательные Secrets:

Эти secrets создаются автоматически GitHub:

- `GITHUB_TOKEN` ✅ (уже есть, ничего делать не нужно)

### Опциональные Secrets (для деплоя):

Добавьте если планируете автоматический деплой:

```bash
# SSH доступ к серверу
DEPLOY_SSH_KEY       # Приватный SSH ключ для подключения к серверу
DEPLOY_HOST          # IP или домен сервера (например: 192.168.1.100)
DEPLOY_USER          # Пользователь для SSH (например: ubuntu)
DEPLOY_PATH          # Путь к приложению на сервере (/var/www/shift-manager)

# API URLs для production
VITE_API_URL         # https://api.yourdomain.com/api/v1
VITE_WS_URL          # https://api.yourdomain.com

# Уведомления (опционально)
SLACK_WEBHOOK        # Webhook для уведомлений в Slack
DISCORD_WEBHOOK      # Webhook для уведомлений в Discord
```

### Как создать SSH ключ для деплоя:

```bash
# На вашей машине
ssh-keygen -t ed25519 -C "github-actions-deploy" -f deploy_key

# Добавьте публичный ключ на сервер
ssh-copy-id -i deploy_key.pub user@your-server.com

# Скопируйте приватный ключ
cat deploy_key
# Вставьте содержимое в GitHub Secret DEPLOY_SSH_KEY
```

---

## 🔄 Как работает Pipeline

### Диаграмма процесса

```
Push/PR → [Lint] → [Type Check] → [Tests] → [Build] → [Docker] → [Security] → [Deploy]
           ✓         ✓              ✓         ✓         ✓          ✓          ✓
```

### Этапы Pipeline

#### 1. 🔍 Lint & Format Check (3-5 мин)
- Проверка кода ESLint
- Проверка форматирования Prettier
- Запускается для Frontend и Backend

**Если падает:** исправьте ошибки линтера локально
```bash
npm run lint:fix
cd server && npm run lint:fix
```

#### 2. 📝 TypeScript Type Check (2-3 мин)
- Проверка типов TypeScript
- Валидация типовой безопасности

**Если падает:** исправьте ошибки типов
```bash
npx tsc --noEmit
```

#### 3. 🧪 Tests (5-10 мин)
- Backend tests с тестовой PostgreSQL БД
- Frontend tests с Vitest
- Генерация coverage отчетов

**Если падают:** исправьте тесты локально
```bash
npm run test
cd server && npm run test
```

#### 4. 🏗️ Build (5-7 мин)
- Сборка Backend (TypeScript → JavaScript)
- Сборка Frontend (Vite production build)
- Сохранение артефактов

**Если падает:** проверьте ошибки сборки локально
```bash
npm run build
cd server && npm run build
```

#### 5. 🐳 Docker Build (8-15 мин)
- Создание Docker образов
- Push в GitHub Container Registry (ghcr.io)
- Кеширование слоев для ускорения

**Образы:**
- `ghcr.io/expertice/shift-mannager-backend:latest`
- `ghcr.io/expertice/shift-mannager-frontend:latest`

#### 6. 🔒 Security Scan (3-5 мин)
- Сканирование на уязвимости (Trivy)
- NPM audit для зависимостей
- Отчет в GitHub Security tab

**Если находит проблемы:** обновите уязвимые зависимости
```bash
npm audit fix
cd server && npm audit fix
```

#### 7. 🚀 Deploy Staging (2-5 мин)
- Автоматический деплой при push в `develop`
- Обновление staging окружения
- Доступно на staging.shift-manager.com

#### 8. 🚀 Deploy Production (2-5 мин)
- Автоматический деплой при push в `master`
- Обновление production окружения
- Создание release на GitHub
- Доступно на shift-manager.com

---

## 🚢 Деплой на сервер

### Вариант 1: Автоматический деплой через SSH

Обновите `.github/workflows/ci-cd.yml` в секции `deploy-production`:

```yaml
deploy-production:
  name: 🚀 Deploy to Production
  runs-on: ubuntu-latest
  needs: [docker-build, security-scan]
  if: github.ref == 'refs/heads/master' && github.event_name == 'push'
  environment:
    name: production
    url: https://shift-manager.com
  steps:
    - name: 📥 Checkout code
      uses: actions/checkout@v4
    
    - name: 🔑 Setup SSH
      uses: webfactory/ssh-agent@v0.8.0
      with:
        ssh-private-key: ${{ secrets.DEPLOY_SSH_KEY }}
    
    - name: 🚀 Deploy to Server
      run: |
        ssh -o StrictHostKeyChecking=no ${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }} << 'EOF'
          cd ${{ secrets.DEPLOY_PATH }}
          git pull origin master
          docker-compose pull
          docker-compose up -d
          docker system prune -f
        EOF
    
    - name: ✅ Verify Deployment
      run: |
        sleep 10
        curl -f https://shift-manager.com/health || exit 1
```

### Вариант 2: Деплой через Docker Compose

На вашем сервере создайте скрипт:

```bash
# /var/www/shift-manager/deploy.sh
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Pull latest images
docker-compose pull

# Restart services
docker-compose up -d

# Run migrations
docker-compose exec -T backend npx prisma migrate deploy

# Clean up
docker system prune -f

echo "✅ Deployment completed!"
```

Затем в workflow:

```yaml
- name: 🚀 Deploy
  run: |
    ssh ${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }} \
      'cd ${{ secrets.DEPLOY_PATH }} && ./deploy.sh'
```

### Вариант 3: Kubernetes (для масштабирования)

Если используете Kubernetes:

```yaml
- name: 🚀 Deploy to Kubernetes
  uses: azure/k8s-deploy@v4
  with:
    manifests: |
      k8s/deployment.yaml
      k8s/service.yaml
    images: |
      ghcr.io/expertice/shift-mannager-backend:${{ github.sha }}
      ghcr.io/expertice/shift-mannager-frontend:${{ github.sha }}
```

---

## 🐛 Troubleshooting

### Pipeline не запускается

**Проблема:** Workflow не появляется во вкладке Actions

**Решение:**
1. Проверьте что файл находится в `.github/workflows/ci-cd.yml`
2. Убедитесь что syntax YAML корректен: https://www.yamllint.com/
3. Сделайте push в ветку `master` или `develop`

### Tests падают на CI но работают локально

**Проблема:** Тесты проходят локально, но падают в CI

**Решение:**
1. Проверьте переменные окружения в workflow
2. Убедитесь что PostgreSQL сервис запущен (для backend tests)
3. Проверьте timeouts - CI может быть медленнее
4. Посмотрите логи тестов в Actions

### Docker build слишком долгий

**Проблема:** Сборка Docker образов занимает >20 минут

**Решение:**
1. Используйте кеширование слоев (уже настроено)
2. Оптимизируйте Dockerfile (COPY только необходимое)
3. Используйте .dockerignore
4. Рассмотрите multi-stage builds

### Deploy fails with permission denied

**Проблема:** Деплой падает с ошибкой доступа

**Решение:**
1. Проверьте SSH ключ в GitHub Secrets
2. Убедитесь что публичный ключ добавлен на сервер
3. Проверьте права доступа к директории на сервере
```bash
# На сервере
chown -R $USER:$USER /var/www/shift-manager
chmod -R 755 /var/www/shift-manager
```

### Security scan находит критические уязвимости

**Проблема:** Trivy или npm audit находит уязвимости

**Решение:**
1. Обновите зависимости:
```bash
npm update
cd server && npm update
```

2. Для критических проблем:
```bash
npm audit fix --force
```

3. Если проблема в транзитивной зависимости, добавьте override в package.json:
```json
{
  "overrides": {
    "vulnerable-package": "^2.0.0"
  }
}
```

---

## 📊 Мониторинг и метрики

### Просмотр статуса Pipeline

1. **GitHub Actions tab:** https://github.com/expertice/shift-maNNager/actions
2. **Конкретный workflow:** Кликните на run чтобы увидеть детали
3. **Логи:** Разверните каждый step чтобы увидеть логи

### Coverage Reports

Отчеты о покрытии тестами автоматически загружаются в Codecov (если настроен).

Для локального просмотра:
```bash
npm run test:coverage
# Откройте coverage/index.html в браузере
```

### Security Reports

Security проблемы отображаются в:
1. **GitHub Security tab:** https://github.com/expertice/shift-maNNager/security
2. **Dependabot alerts:** автоматические уведомления о уязвимостях
3. **Code scanning:** результаты Trivy сканирования

---

## 📚 Дополнительные ресурсы

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Documentation](https://docs.docker.com/)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

## ✅ Checklist для первого запуска

- [ ] Workflow файл находится в `.github/workflows/ci-cd.yml`
- [ ] Сделан push в `master` или `develop`
- [ ] Pipeline запустился во вкладке Actions
- [ ] Все jobs (lint, test, build) проходят успешно
- [ ] Docker образы собираются и пушатся в registry
- [ ] (Опционально) Настроены GitHub Secrets для деплоя
- [ ] (Опционально) Настроен staging/production сервер
- [ ] (Опционально) Автоматический деплой работает

---

## 🎉 Поздравляем!

Ваш CI/CD pipeline готов к работе! Теперь при каждом push код будет автоматически проверяться, тестироваться и деплоиться.

**Следующие шаги:**
1. Настройте уведомления (Slack/Discord)
2. Добавьте E2E тесты
3. Настройте мониторинг production окружения
4. Создайте staging окружение для тестирования

Удачи! 🚀

