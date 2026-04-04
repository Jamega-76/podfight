# 🚀 GitHub Push Setup

To enable automatic pushing to GitHub, you need to authenticate once.

## Option 1: GitHub Personal Access Token (Recommended)

1. Go to https://github.com/settings/tokens/new
2. Create a token with `repo` scope
3. Copy the token
4. In terminal, run:
```bash
git config --global credential.helper osxkeychain
git push -u origin main
# Paste your token as the password when prompted
```

The token will be saved and future pushes will be automatic!

## Option 2: GitHub CLI (Easier)

1. Install GitHub CLI: `brew install gh`
2. Run: `gh auth login` (follow prompts)
3. Run: `git push -u origin main`

That's it! Your credentials are stored.

---

Once you push once, you can set up an auto-push hook:

```bash
# This will auto-push after each commit
mkdir -p .git/hooks
cat > .git/hooks/post-commit << 'EOF'
#!/bin/bash
git push origin main 2>/dev/null
EOF
chmod +x .git/hooks/post-commit
```

Now every time you save changes, they'll auto-push to GitHub! 🎉
