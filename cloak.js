(function () {
  'use strict';

  const CLOAKED_FLAG = 'cloaked';

  function writeShell(target, url) {
    const document = target.document;
    document.open();
    document.write(`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>New Tab</title>
          <link rel="icon" href="data:,">
          <style>html,body,iframe{width:100%;height:100%;margin:0;border:0;background:#050816}body{overflow:hidden}</style>
        </head>
        <body><iframe src="${url.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" title="Homework Hub"></iframe></body>
      </html>`);
    document.close();
  }

  function launchCloaked() {
    if (window.top !== window.self) return true;

    const url = new URL(window.location.href);
    url.searchParams.set(CLOAKED_FLAG, '1');
    const blank = window.open('about:blank', '_blank');
    if (!blank) return false;

    writeShell(blank, url.href);
    blank.focus();
    return true;
  }

  window.Cloak = { launch: launchCloaked };

  const params = new URLSearchParams(window.location.search);
  if (window.top === window.self && !params.has(CLOAKED_FLAG)) {
    // Browsers may block an automatic popup. A visible button on the menu lets
    // the user retry from a trusted click without pretending the launch worked.
    launchCloaked();
  }
})();
