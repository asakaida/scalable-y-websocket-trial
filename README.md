# scalable-y-websocket-trial

## 初回の手順

コンテナのビルド、起動、DBの作成、テーブルのマイグレーションとサーバーの起動を実行します。

```bash
cd /path/to # /path/to以下に本リポジトリーのコードを設置することとします。適宜変更してください。
git clone https://github.com/asakaida/scalable-y-websocket-trial
cd /path/to/scalable-y-websocket-trial
npm install
docker-compose up -d
./prepare_db.sh
```

docker-compose.ymlを使用している場合は、localhostの15432番ポートでPostgreSQLに接続 できます。

PostgreSQLに接続し、items.sqlの内容を実行し、itemsテーブルを作成します。

## 起動手順

```bash
cd /path/to/scalable-y-websocket-trial
npm run start
```

localホストの9000番ポートでHTTPサーバーが起動しています。

Redis、PostgreSQL、HTTPサーバーのホストやポート番号を変更したい場合は、config.jsの内容を書き替え、サーバーを再起動します。

以上