Proof Of Uniqueness - Desktop Client (ElectronJs)

- NodeJs - v20.0.0
- Npm - 9.6.4
- Typescript (tsc) - Version 5.7.3

#### Clone

```bash
# ssh
git clone git@github.com:Proof-Of-Uniqueness/masternode-client.git

# https
git clone https://github.com/Proof-Of-Uniqueness/masternode-client
```

#### Install dependencies

```bash
npm install

# or
npm i
```

#### Run devevelopment setup

```bash
npm run dev
```

#### Build Mac distribution app

First, install Python and ensure distutils is available:

```bash
brew install python@3
```

Install the missing distutils package using pip.

1. First, create a new virtual environment:

```bash
python3 -m venv ./venv
```

2. Activate the virtual environment:

```bash
source ./venv/bin/activate
```

3. Now install setuptools in the virtual environment:

```bash
pip3 install setuptools
```

4. Build the distribution app :

```bash
# this will build two apps
# one for intel macs & one for arm macs

npm run dist:mac
```

#### Build Linux distribution app

```bash
npm run dist:linux
```

#### Build Windows distribution app

```bash
npm run dist:win
```
