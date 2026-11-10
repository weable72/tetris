# GitHub Pages 배포 가이드

이 게임을 GitHub Pages로 배포하는 절차입니다.

| 항목 | 값 |
| --- | --- |
| GitHub 계정 | `weable72` |
| 저장소 | `tetris` |
| 로컬 작업 폴더 | `~/work/tetris` |
| 원격 주소 (SSH) | `git@github.com:weable72/tetris.git` |
| 배포 후 접속 주소 | https://weable72.github.io/tetris/ |

빌드 과정이 없는 정적 사이트(`index.html`, `game.html`, `style.css`, `game.js`, `music.js`)라서 GitHub Actions 없이 **브랜치에서 바로 배포** 방식을 사용합니다.
모든 파일 경로가 상대 경로(`style.css`, `game.html` 등)여서 `/tetris/` 하위 경로로 배포해도 그대로 동작합니다.

---

## 1. 프로젝트를 `~/work/tetris`로 복사

```bash
mkdir -p ~/work/tetris
cp -r ~/work/vibe/day12/tetris/. ~/work/tetris/
cd ~/work/tetris
ls
```

> `~/work/tetris`가 이미 있고 안에 파일이 있다면, 덮어쓰기 전에 내용을 먼저 확인하세요.

GitHub Pages가 Jekyll로 파일을 가공하지 않고 그대로 서비스하도록 빈 `.nojekyll` 파일을 만듭니다.

```bash
touch .nojekyll
```

> **공개 범위 확인:** GitHub Pages는 공개 저장소에서 무료로 쓸 수 있으므로 저장소의 모든 파일이 공개됩니다.
> `WORKFLOW.md`(프롬프트 기록), `PLAN.md`, `AGENTS.md`, `CLAUDE.md`도 함께 올라갑니다. 공개하고 싶지 않은 파일이 있으면 아래처럼 `.gitignore`에 추가하세요.
>
> ```bash
> # 예시: 작업 기록 파일을 올리지 않으려면
> printf 'WORKFLOW.md\nPLAN.md\n' >> .gitignore
> ```

---

## 2. SSH 키 준비 (처음 한 번만)

### 2-1. 기존 키 확인

```bash
ls ~/.ssh/id_ed25519.pub
```

파일이 있으면 2-3으로 넘어갑니다.

### 2-2. 새 키 만들기

```bash
ssh-keygen -t ed25519 -C "GitHub 계정 이메일"
```

- 저장 위치는 그냥 Enter를 눌러 기본값(`~/.ssh/id_ed25519`)을 사용합니다.
- 암호(passphrase)는 원하면 입력하고, 아니면 Enter를 누릅니다.

암호를 설정했다면 ssh-agent에 키를 등록해 두면 매번 입력하지 않아도 됩니다.

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

### 2-3. GitHub에 공개 키 등록

1. 공개 키 내용을 출력해 복사합니다.
   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```
2. GitHub → 오른쪽 위 프로필 → **Settings** → **SSH and GPG keys** → **New SSH key**
3. Title은 알아보기 쉬운 이름(예: `WSL`)으로, Key type은 **Authentication Key**로 두고, 복사한 내용을 붙여넣은 뒤 **Add SSH key**를 누릅니다.

### 2-4. 연결 확인

```bash
ssh -T git@github.com
```

처음 접속하면 호스트를 신뢰할지 묻습니다. `yes`를 입력하세요. 다음 메시지가 나오면 성공입니다.

```
Hi weable72! You've successfully authenticated, but GitHub does not provide shell access.
```

---

## 3. GitHub에 저장소 만들기

1. https://github.com/new 접속
2. **Repository name**: `tetris`
3. **Public** 선택 (무료 계정에서 Pages를 쓰려면 공개 저장소여야 합니다)
4. **README, .gitignore, license는 추가하지 않습니다** (로컬에 이미 파일이 있어서, 추가하면 첫 push에서 충돌이 납니다)
5. **Create repository** 클릭

> GitHub CLI(`gh`)를 쓴다면 4단계에서 터미널로 한 번에 만들 수도 있습니다: `gh repo create weable72/tetris --public --source=. --remote=origin --push`

---

## 4. 로컬 저장소 연동 후 push

```bash
cd ~/work/tetris

# 처음 한 번: 커밋 작성자 정보 설정 (이미 설정했다면 생략)
git config --global user.name "이름"
git config --global user.email "GitHub 계정 이메일"

git init -b main
git add .
git commit -m "블록 쌓기 게임 첫 배포"

git remote add origin git@github.com:weable72/tetris.git
git push -u origin main
```

확인:

```bash
git remote -v
# origin  git@github.com:weable72/tetris.git (fetch)
# origin  git@github.com:weable72/tetris.git (push)
```

> 이메일을 공개하고 싶지 않다면 GitHub → Settings → Emails에 있는 `숫자+weable72@users.noreply.github.com` 주소를 `user.email`로 쓰면 됩니다.

---

## 5. GitHub Pages 켜기

1. https://github.com/weable72/tetris → **Settings** → 왼쪽 메뉴 **Pages**
2. **Build and deployment**
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` / 폴더 `/ (root)` → **Save**
3. 1~2분 정도 기다리면 같은 화면 위쪽에 사이트 주소가 표시됩니다. 진행 상황은 저장소의 **Actions** 탭(`pages build and deployment`)에서 볼 수 있습니다.

접속 주소:

- 랜딩 페이지: https://weable72.github.io/tetris/
- 게임 화면: https://weable72.github.io/tetris/game.html

HTTPS로 배포되므로 휴대폰에서도 같은 주소로 바로 플레이할 수 있습니다.

---

## 6. 이후 수정 사항 배포하기

`~/work/tetris`에서 파일을 고친 뒤:

```bash
cd ~/work/tetris
git add .
git commit -m "변경 내용 설명"
git push
```

push하면 GitHub Pages가 자동으로 다시 배포합니다(보통 1분 내외).

> 원래 폴더(`~/work/vibe/day12/tetris`)에서 계속 작업한다면, 배포 전에 변경 사항을 복사해 오세요. `.git` 폴더를 건드리지 않고 파일만 맞춥니다.
>
> ```bash
> rsync -av --exclude .git ~/work/vibe/day12/tetris/ ~/work/tetris/
> ```

---

## 7. 문제 해결

| 증상 | 원인 / 해결 |
| --- | --- |
| `Permission denied (publickey)` | SSH 키가 GitHub에 등록되지 않았거나 ssh-agent에 없습니다. 2-3, 2-4를 다시 확인하고 `ssh-add ~/.ssh/id_ed25519`를 실행하세요. |
| `remote origin already exists` | `git remote set-url origin git@github.com:weable72/tetris.git`로 주소를 바꾸세요. |
| push가 `rejected (fetch first)`로 거부됨 | 저장소를 만들 때 README 등을 추가했기 때문입니다. `git pull --rebase origin main` 후 다시 `git push`하세요. |
| 사이트가 404 | Pages 설정의 브랜치가 `main` / `/(root)`인지, 저장소 루트에 `index.html`이 있는지 확인하고 몇 분 기다리세요. |
| 수정했는데 화면이 그대로 | 배포가 끝났는지 Actions 탭에서 확인하고, 브라우저 캐시를 지우거나 강력 새로고침(`Ctrl + Shift + R`)하세요. |
| 음악이 안 나옴 | **시작하기**를 눌러야 재생됩니다. 휴대폰이 무음 모드인지, 상단 음표 버튼이 꺼져 있지 않은지 확인하세요. |
