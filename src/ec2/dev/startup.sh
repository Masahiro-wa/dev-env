#!/bin/bash

# 更新と必要なツールのインストール
dnf update -y
dnf install -y gcc zlib-devel bzip2 bzip2-devel readline-devel sqlite sqlite-devel openssl-devel xz xz-devel libffi-devel wget curl --allowerasing

# Gitのインストール確認
dnf install -y git

#mysqlのインストール
dnf install mariadb105-server

# その他の必要なツールのインストール
dnf install -y ncurses-devel lzma 

dnf list installed

# Pyenv のインストール
export PYENV_ROOT="/usr/local/pyenv"
curl https://pyenv.run | bash
export PATH="$PYENV_ROOT/bin:$PATH"

# Pyenv の設定を追加
cat << 'EOF' > /etc/profile.d/pyenv.sh
export PYENV_ROOT="/usr/local/pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init --path)"
eval "$(pyenv init -)"
eval "$(pyenv virtualenv-init -)"
EOF

chmod +x /etc/profile.d/pyenv.sh
./etc/profile.d/pyenv.sh

# Pyenvインストールの確認
if command -v pyenv >/dev/null; then
    echo "Pyenvが正常にインストールされました。"
    pyenv install 3.12.3
    pyenv global 3.12.3
else
    echo "Pyenvのインストールに失敗しました。"
fi


# Pythonの確認
python --version

# Docker のインストール
sudo dnf install -y docker
sudo systemctl start docker
sudo systemctl enable docker

# ec2-userをDockerグループに追加
sudo usermod -aG docker ec2-user

echo "Python 3.12 (Pyenv)とDockerのインストールが完了しました。再ログインしてDockerグループの設定を有効にしてください。"
