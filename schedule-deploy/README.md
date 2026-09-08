# 근무표 정리 앱 — 배포 가이드

Supabase(저장) + Google Gemini(무료 사진 분석) + Vercel(호스팅) 구조입니다.

## 1. Supabase 설정
1. https://supabase.com 에서 무료 계정 생성 후 새 프로젝트 만들기
2. 왼쪽 메뉴 **SQL Editor** → 이 프로젝트의 `supabase-schema.sql` 내용을 붙여넣고 실행
3. 왼쪽 메뉴 **Project Settings → API** 에서 다음 두 값을 복사해두기
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`

## 2. Gemini API 키 발급 (무료)
1. https://aistudio.google.com/app/apikey 접속 (구글 계정 로그인)
2. "Create API key" 클릭 → 키 복사
3. 이 값은 `GEMINI_API_KEY`로 사용 (앞에 `VITE_` 붙이지 않기! 서버에서만 써야 안전해요)

## 3. 로컬에서 테스트 (선택)
```bash
npm install
cp .env.example .env
# .env 파일을 열어서 위에서 받은 값들로 채우기
npm run dev
```
※ 로컬 `npm run dev`에서는 `/api/parse-schedule` 서버리스 함수가 자동으로 동작하지 않을 수 있어요.
   Vercel CLI(`npx vercel dev`)로 실행하면 로컬에서도 서버리스 함수까지 함께 테스트할 수 있어요.

## 4. GitHub에 올리기
```bash
git init
git add .
git commit -m "근무표 정리 앱"
# GitHub에서 새 저장소를 만든 뒤 안내되는 명령어로 push
git remote add origin <내 저장소 URL>
git push -u origin main
```

## 5. Vercel에 배포
1. https://vercel.com 에서 GitHub 계정으로 로그인
2. "Add New… → Project" → 방금 올린 저장소 선택
3. **Environment Variables**에 아래 3개 추가
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY`
4. Deploy 클릭 → 잠시 후 실제 URL 생성됨 (예: `내스케줄.vercel.app`)

이후 코드를 고쳐서 GitHub에 다시 push하면 Vercel이 자동으로 재배포해요.

## 6. 아이폰 홈 화면에 추가
1. 사파리에서 배포된 URL 접속
2. 공유 버튼 → **홈 화면에 추가**
3. 아이콘이 생기고, 탭하면 앱처럼 전체 화면으로 열려요

## 참고사항
- 이 구성은 로그인 기능이 없는 개인용 버전이에요. Supabase의 anon key와 URL을 아는 사람은 누구나 이 표에 접근할 수 있어요(민감한 정보가 아니라면 개인 사용엔 문제없는 수준이에요).
- Gemini 무료 할당량은 개인이 주 1~2회 사진을 올리는 수준으로는 충분히 넉넉해요.
