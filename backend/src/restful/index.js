import express from '@/vendor/express';
import $ from '@/core/app';
import migrate from '@/utils/migration';
import download from '@/utils/download';
import { syncArtifacts, produceArtifact } from '@/restful/sync';
import { gistBackupAction } from '@/restful/miscs';
import { TOKENS_KEY } from '@/constants';

import registerSubscriptionRoutes from './subscriptions';
import registerCollectionRoutes from './collections';
import registerArtifactRoutes from './artifacts';
import registerFileRoutes from './file';
import registerTokenRoutes from './token';
import registerModuleRoutes from './module';
import registerSyncRoutes from './sync';
import registerDownloadRoutes from './download';
import registerSettingRoutes from './settings';
import registerPreviewRoutes from './preview';
import registerSortingRoutes from './sort';
import registerMiscRoutes from './miscs';
import registerNodeInfoRoutes from './node-info';
import registerParserRoutes from './parser';

export default function serve() {
    let port;
    let host;
    if ($.env.isNode) {
        port = eval('process.env.SUB_STORE_BACKEND_API_PORT') || 3000;
        host = eval('process.env.SUB_STORE_BACKEND_API_HOST') || '::';
    }
    const $app = express({ substore: $, port, host });
    if ($.env.isNode) {
        const be_prefix = eval('process.env.SUB_STORE_BACKEND_PREFIX');
        const fe_be_path = eval('process.env.SUB_STORE_FRONTEND_BACKEND_PATH');
        if (be_prefix) {
            if(!fe_be_path.startsWith('/')){
                throw new Error(
                    'SUB_STORE_FRONTEND_BACKEND_PATH should start with /',
                );
            }
            $app.use((req, res, next) => {
                if (req.path.startsWith(fe_be_path)) {
                    const newPath = req.url.replace(fe_be_path, '') || '/';
                    req.url = newPath;
                    next();
                } else {
                    res.status(403).send();
                }
            });
        }
    }
    // register routes
    registerCollectionRoutes($app);
    registerSubscriptionRoutes($app);
    registerDownloadRoutes($app);
    registerPreviewRoutes($app);
    registerSortingRoutes($app);
    registerSettingRoutes($app);
    registerArtifactRoutes($app);
    registerFileRoutes($app);
    registerTokenRoutes($app);
    registerModuleRoutes($app);
    registerSyncRoutes($app);
    registerNodeInfoRoutes($app);
    registerMiscRoutes($app);
    registerParserRoutes($app);

    $app.start();

    if ($.env.isNode) {
        // Deprecated: SUB_STORE_BACKEND_CRON
        const backend_sync_cron =
            eval('process.env.SUB_STORE_BACKEND_SYNC_CRON') ||
            eval('process.env.SUB_STORE_BACKEND_CRON');
        if (backend_sync_cron) {
            $.info(`[SYNC CRON] ${backend_sync_cron} enabled`);
            const { CronJob } = eval(`require("cron")`);
            new CronJob(
                backend_sync_cron,
                async function () {
                    try {
                        $.info(`[SYNC CRON] ${backend_sync_cron} started`);
                        await syncArtifacts();
                        $.info(`[SYNC CRON] ${backend_sync_cron} finished`);
                    } catch (e) {
                        $.error(
                            `[SYNC CRON] ${backend_sync_cron} error: ${
                                e.message ?? e
                            }`,
                        );
                    }
                }, // onTick
                null, // onComplete
                true, // start
                // 'Asia/Shanghai' // timeZone
            );
        }
        // 格式: 0 */2 * * *,sub,a;0 */3 * * *,col,b
        // 每 2 小时处理一次单条订阅 a, 每 3 小时处理一次组合订阅 b
        const produce_cron = eval('process.env.SUB_STORE_PRODUCE_CRON');
        if (produce_cron) {
            $.info(`[PRODUCE CRON] ${produce_cron} enabled`);
            const { CronJob } = eval(`require("cron")`);
            produce_cron.split(/\s*;\s*/).map((item) => {
                const [cron, type, name] = item.split(/\s*,\s*/);
                new CronJob(
                    cron.trim(),
                    async function () {
                        try {
                            $.info(
                                `[PRODUCE CRON] ${type} ${name} ${cron} started`,
                            );
                            await produceArtifact({ type, name });
                            $.info(
                                `[PRODUCE CRON] ${type} ${name} ${cron} finished`,
                            );
                        } catch (e) {
                            $.error(
                                `[PRODUCE CRON] ${type} ${name} ${cron} error: ${
                                    e.message ?? e
                                }`,
                            );
                        }
                    }, // onTick
                    null, // onComplete
                    true, // start
                    // 'Asia/Shanghai' // timeZone
                );
            });
        }
        const backend_download_cron = eval(
            'process.env.SUB_STORE_BACKEND_DOWNLOAD_CRON',
        );
        if (backend_download_cron) {
            $.info(`[DOWNLOAD CRON] ${backend_download_cron} enabled`);
            const { CronJob } = eval(`require("cron")`);
            new CronJob(
                backend_download_cron,
                async function () {
                    try {
                        $.info(
                            `[DOWNLOAD CRON] ${backend_download_cron} started`,
                        );
                        await gistBackupAction('download');
                        $.info(
                            `[DOWNLOAD CRON] ${backend_download_cron} finished`,
                        );
                    } catch (e) {
                        $.error(
                            `[DOWNLOAD CRON] ${backend_download_cron} error: ${
                                e.message ?? e
                            }`,
                        );
                    }
                }, // onTick
                null, // onComplete
                true, // start
                // 'Asia/Shanghai' // timeZone
            );
        }
        const backend_upload_cron = eval(
            'process.env.SUB_STORE_BACKEND_UPLOAD_CRON',
        );
        if (backend_upload_cron) {
            $.info(`[UPLOAD CRON] ${backend_upload_cron} enabled`);
            const { CronJob } = eval(`require("cron")`);
            new CronJob(
                backend_upload_cron,
                async function () {
                    try {
                        $.info(`[UPLOAD CRON] ${backend_upload_cron} started`);
                        await gistBackupAction('upload');
                        $.info(`[UPLOAD CRON] ${backend_upload_cron} finished`);
                    } catch (e) {
                        $.error(
                            `[UPLOAD CRON] ${backend_upload_cron} error: ${
                                e.message ?? e
                            }`,
                        );
                    }
                }, // onTick
                null, // onComplete
                true, // start
                // 'Asia/Shanghai' // timeZone
            );
        }
        const path = eval(`require("path")`);
        const fs = eval(`require("fs")`);
        const data_url = eval('process.env.SUB_STORE_DATA_URL');
        const fe_be_path = eval('process.env.SUB_STORE_FRONTEND_BACKEND_PATH');
        const fe_port = eval('process.env.SUB_STORE_FRONTEND_PORT') || 3001;
        const fe_host =
            eval('process.env.SUB_STORE_FRONTEND_HOST') || host || '::';
        const fe_path = eval('process.env.SUB_STORE_FRONTEND_PATH');
        const fe_abs_path = path.resolve(
            fe_path || path.join(__dirname, 'frontend'),
        );
        if (fe_path) {
            try {
                fs.accessSync(path.join(fe_abs_path, 'index.html'));
            } catch (e) {
                $.error(
                    `[FRONTEND] index.html file not found in ${fe_abs_path}`,
                );
            }

            const express_ = eval(`require("express")`);
            const history = eval(`require("connect-history-api-fallback")`);
            const { createProxyMiddleware } = eval(
                `require("http-proxy-middleware")`,
            );

            const app = express_();

            const staticFileMiddleware = express_.static(fe_path);

            let be_api = '/api/';
            let be_download = '/download/';
            let be_share = '/share/';
            let be_download_rewrite = '';
            let be_api_rewrite = '';
            let be_share_rewrite = `${be_share}:type/:name`;
            let prefix = eval('process.env.SUB_STORE_BACKEND_PREFIX') ? fe_be_path : '';
            if (fe_be_path) {
                if (!fe_be_path.startsWith('/')) {
                    throw new Error(
                        'SUB_STORE_FRONTEND_BACKEND_PATH should start with /',
                    );
                }
                be_api_rewrite = `${
                    fe_be_path === '/' ? '' : fe_be_path
                }${be_api}`;
                be_download_rewrite = `${
                    fe_be_path === '/' ? '' : fe_be_path
                }${be_download}`;

                app.use(
                    be_share_rewrite,
                    createProxyMiddleware({
                        target: `http://127.0.0.1:${port}${prefix}`,
                        changeOrigin: true,
                        pathRewrite: async (path, req) => {
                            if (req.method.toLowerCase() !== 'get')
                                throw new Error('Method not allowed');
                            const tokens = $.read(TOKENS_KEY) || [];
                            const token = tokens.find(
                                (t) =>
                                    t.token === req.query.token &&
                                    t.type === req.params.type &&
                                    t.name === req.params.name &&
                                    (t.exp == null || t.exp > Date.now()),
                            );
                            if (!token) throw new Error('Forbbiden');
                            return req.originalUrl;
                        },
                    }),
                );
                app.use(
                    be_api_rewrite,
                    createProxyMiddleware({
                        target: `http://127.0.0.1:${port}${prefix}${be_api}`,
                        pathRewrite: async (path) => {
                            return path.includes('?')
                                ? `${path}&share=true`
                                : `${path}?share=true`;
                        },
                    }),
                );
                app.use(
                    be_download_rewrite,
                    createProxyMiddleware({
                        target: `http://127.0.0.1:${port}${prefix}${be_download}`,
                        changeOrigin: true,
                    }),
                );
            }

            app.use(staticFileMiddleware);
            app.use(
                history({
                    disableDotRule: true,
                    verbose: false,
                }),
            );
            app.use(staticFileMiddleware);

            const listener = app.listen(fe_port, fe_host, () => {
                const { address: fe_address, port: fe_port } =
                    listener.address();
                $.info(`[FRONTEND] ${fe_address}:${fe_port}`);
                if (fe_be_path) {
                    $.info(
                        `[FRONTEND -> BACKEND] ${fe_address}:${fe_port}${be_api_rewrite} -> http://127.0.0.1:${port}${prefix}${be_api}`,
                    );
                    $.info(
                        `[FRONTEND -> BACKEND] ${fe_address}:${fe_port}${be_download_rewrite} -> http://127.0.0.1:${port}${prefix}${be_download}`,
                    );
                    $.info(
                        `[SHARE BACKEND] ${fe_address}:${fe_port}${be_share_rewrite}`,
                    );
                }
            });
        }
        if (data_url) {
            $.info(`[BACKEND] downloading data from ${data_url}`);
            download(data_url)
                .then((content) => {
                    $.write(content, '#sub-store');

                    $.cache = JSON.parse(content);
                    $.persistCache();

                    migrate();
                    $.info(`[BACKEND] restored data from ${data_url}`);
                })
                .catch((e) => {
                    $.error(`[BACKEND] restore data failed`);
                    console.error(e);
                    throw e;
                });
        }
    }
}
