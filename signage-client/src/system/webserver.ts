let onVideoEndedCallback: (() => void) | null = null;

export function setOnVideoEnded(callback: () => void): void {
  onVideoEndedCallback = callback;
}

export function startLocalServer(port: number): void {
  Deno.serve({ port, hostname: '127.0.0.1', onListen: () => {
    console.log(`[LOCAL] Web server listening on http://127.0.0.1:${port}`);
  }}, (req) => {
    const url = new URL(req.url);

    if (url.pathname === '/embed/image') {
      return handleImageEmbed(url);
    }

    if (url.pathname === '/embed/youtube') {
      return handleYoutubeEmbed(url);
    }

    if (url.pathname === '/video-ended') {
      console.log('[LOCAL] Video ended signal received');
      onVideoEndedCallback?.();
      return new Response('ok', { status: 200 });
    }

    if (url.pathname === '/log') {
      const msg = url.searchParams.get('msg') || '';
      console.log(`[YOUTUBE] ${msg}`);
      return new Response('ok', { status: 200 });
    }

    return new Response('Not found', { status: 404 });
  });
}

function handleYoutubeEmbed(url: URL): Response {
  const videoId = url.searchParams.get('v') || '';
  const listId = url.searchParams.get('list') || '';
  const muted = url.searchParams.get('muted') === '1';
  const loop = url.searchParams.get('loop') === '1';
  const loopCount = parseInt(url.searchParams.get('loopCount') || '1', 10) || 1;

  if (!videoId && !listId) {
    return new Response('Missing v or list parameter', { status: 400 });
  }

  const playerVars: Record<string, string | number> = {
    autoplay: 1,
    controls: 0,
    modestbranding: 1,
    rel: 0,
    showinfo: 0,
    iv_load_policy: 3,
    fs: 0,
    disablekb: 1,
  };
  if (listId) playerVars.list = listId;
  if (listId && !videoId) playerVars.listType = 'playlist';
  if (loop && loopCount <= 1) playerVars.loop = 1;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Signage</title>
<style>*{margin:0;padding:0}body{background:#000;overflow:hidden}#player{width:100vw;height:100vh}</style>
</head><body>
<div id="player"></div>
<script>
  var tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);

  var player;
  var loopEnabled = ${loop};
  var loopsRemaining = ${loopCount};
  var isMuted = ${muted};
  var playerReady = false;
  var ended = false;

  function log(msg) {
    fetch('/log?msg=' + encodeURIComponent(msg)).catch(function(){});
  }

  function signalEnded() {
    if (ended) return;
    ended = true;
    fetch('/video-ended').catch(function(){});
  }

  // Fallback: if player never becomes ready, skip after 15s
  var fallbackTimer = setTimeout(function() {
    if (!playerReady) {
      log('Player never became ready, skipping');
      signalEnded();
    }
  }, 15000);

  window.onYouTubeIframeAPIReady = function() {
    log('IFrame API ready, creating player');
    player = new YT.Player('player', {
      width: '100%',
      height: '100%',
      videoId: '${videoId}',
      playerVars: ${JSON.stringify(playerVars)},
      events: {
        onStateChange: function(event) {
          log('State changed: ' + event.data);
          if (event.data === YT.PlayerState.ENDED) {
            if (loopEnabled && loopsRemaining > 1) {
              loopsRemaining--;
              player.seekTo(0);
              player.playVideo();
            } else {
              signalEnded();
            }
          }
        },
        onError: function(event) {
          log('Error code: ' + event.data);
          signalEnded();
        },
        onReady: function(event) {
          playerReady = true;
          clearTimeout(fallbackTimer);
          log('Player ready');
          if (isMuted) {
            event.target.mute();
          }
          event.target.playVideo();
          // Check if video actually started playing after 3s
          setTimeout(function() {
            try {
              var state = player.getPlayerState();
              var duration = player.getDuration();
              log('Playback check — state: ' + state + ', duration: ' + duration);
              if (duration === 0 || isNaN(duration)) {
                log('Video has no duration (unavailable), skipping');
                signalEnded();
                return;
              }
              if (state !== 1 && state !== 3) {
                log('Video not playing (state ' + state + '), skipping');
                signalEnded();
              }
            } catch(e) {
              log('Player check failed: ' + e);
              signalEnded();
            }
          }, 3000);
        }
      }
    });
  };
</script>
</body></html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function handleImageEmbed(url: URL): Response {
  const src = url.searchParams.get('src') || '';
  const fit = url.searchParams.get('fit') || 'contain';
  const bgColor = url.searchParams.get('bg') || '#000000';

  if (!src) {
    return new Response('Missing src parameter', { status: 400 });
  }

  // Map fit values to CSS object-fit + sizing
  let imgStyle = '';
  if (fit === 'cover') {
    imgStyle = 'width:100vw;height:100vh;object-fit:cover;';
  } else if (fit === 'fill') {
    imgStyle = 'width:100vw;height:100vh;object-fit:fill;';
  } else {
    imgStyle = 'max-width:100vw;max-height:100vh;object-fit:contain;';
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Signage</title>
<style>
  *{margin:0;padding:0}
  body{background:${bgColor};display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden}
  img{${imgStyle}}
</style></head>
<body><img src="${src.replace(/"/g, '&quot;')}" /></body></html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
