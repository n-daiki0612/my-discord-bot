const esbuild = require('esbuild');
const { GasPlugin } = require('esbuild-gas-plugin');
const path = require('path');


esbuild
    .build({
        entryPoints: [path.join(__dirname, "src", "main.ts")],
        bundle: true,
        minify: true,
        target:"es2019",
        outfile: path.join(__dirname, "dist", "main.js"),
        plugins: [GasPlugin,
        ],
    })
    .catch((error) => {
        console.log('ビルドに失敗しました')
        console.error(error);
        process.exit(1);
    });
