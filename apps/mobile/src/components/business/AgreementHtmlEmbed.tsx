import { createElement, useCallback, useEffect, useRef } from 'react';
import { Platform, StyleSheet, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

type Props = {
  html: string;
  style?: ViewStyle;
  /** Fired once when the user scrolls to (or near) the bottom after content is stable. */
  onScrolledToEnd?: () => void;
  /** Fired when content height grows after a prior unlock (must re-scroll). */
  onScrollReset?: () => void;
};

const SCROLL_END_THRESHOLD_PX = 24;

/** Renders agreement HTML on native (WebView) and web (iframe srcDoc). */
export function AgreementHtmlEmbed({
  html,
  style,
  onScrolledToEnd,
  onScrollReset,
}: Props) {
  const content = html || '<p></p>';
  const reportedRef = useRef(false);
  const generationRef = useRef(0);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    reportedRef.current = false;
    generationRef.current += 1;
  }, [html]);

  const reportEnd = useCallback(
    (generation: number) => {
      if (generation !== generationRef.current) return;
      if (reportedRef.current) return;
      reportedRef.current = true;
      onScrolledToEnd?.();
    },
    [onScrolledToEnd]
  );

  const buildInjectedJs = useCallback((generation: number) => {
    return `
(function() {
  var generation = ${generation};
  var unlocked = false;
  var lastHeight = 0;
  var stableCount = 0;
  function metrics() {
    var doc = document.documentElement || document.body;
    var scrollTop = window.pageYOffset || doc.scrollTop || 0;
    var clientHeight = window.innerHeight || doc.clientHeight || 0;
    var scrollHeight = Math.max(doc.scrollHeight || 0, document.body.scrollHeight || 0);
    return { scrollTop: scrollTop, clientHeight: clientHeight, scrollHeight: scrollHeight };
  }
  function nearBottom(m) {
    if (m.scrollHeight <= 0 || m.clientHeight <= 0) return false;
    return m.scrollTop + m.clientHeight >= m.scrollHeight - ${SCROLL_END_THRESHOLD_PX};
  }
  function post(type) {
    if (!window.ReactNativeWebView) return;
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, generation: generation }));
  }
  function sample() {
    var m = metrics();
    if (m.scrollHeight <= 0) return;
    if (unlocked && m.scrollHeight > lastHeight + 8) {
      // Content grew after unlock — require another scroll-to-end.
      unlocked = false;
      stableCount = 0;
      lastHeight = m.scrollHeight;
      post('scrollReset');
      return;
    }
    if (m.scrollHeight === lastHeight) {
      stableCount += 1;
    } else {
      lastHeight = m.scrollHeight;
      stableCount = 0;
      return;
    }
    if (!unlocked && stableCount >= 2 && nearBottom(m)) {
      unlocked = true;
      post('scrolledToEnd');
    }
  }
  window.addEventListener('scroll', sample, { passive: true });
  window.addEventListener('resize', sample);
  setInterval(sample, 400);
  true;
})();
`;
  }, []);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type?: string;
          generation?: number;
        };
        if (data.generation !== generationRef.current) return;
        if (data.type === 'scrollReset') {
          reportedRef.current = false;
          onScrollReset?.();
          return;
        }
        if (data.type === 'scrolledToEnd') {
          reportEnd(data.generation ?? -1);
        }
      } catch {
        // ignore non-JSON messages
      }
    },
    [onScrollReset, reportEnd]
  );

  if (Platform.OS === 'web') {
    return createElement('iframe', {
      title: 'Merchant agreement',
      srcDoc: content,
      onLoad: (e: { currentTarget: HTMLIFrameElement }) => {
        const iframe = e.currentTarget;
        const generation = generationRef.current;
        try {
          const doc = iframe.contentDocument;
          const win = iframe.contentWindow;
          if (!doc || !win) return;
          let unlocked = false;
          let lastHeight = 0;
          let stableCount = 0;
          const check = () => {
            if (generation !== generationRef.current) return;
            const el = doc.documentElement;
            const scrollHeight = el.scrollHeight || 0;
            const clientHeight = win.innerHeight || 0;
            if (scrollHeight <= 0 || clientHeight <= 0) return;
            if (unlocked && scrollHeight > lastHeight + 8) {
              unlocked = false;
              stableCount = 0;
              lastHeight = scrollHeight;
              reportedRef.current = false;
              onScrollReset?.();
              return;
            }
            if (scrollHeight === lastHeight) {
              stableCount += 1;
            } else {
              lastHeight = scrollHeight;
              stableCount = 0;
              return;
            }
            if (
              !unlocked &&
              stableCount >= 2 &&
              win.scrollY + clientHeight >= scrollHeight - SCROLL_END_THRESHOLD_PX
            ) {
              unlocked = true;
              reportEnd(generation);
            }
          };
          win.addEventListener('scroll', check, { passive: true });
          const interval = win.setInterval(check, 400);
          win.addEventListener('unload', () => win.clearInterval(interval));
        } catch {
          // Cross-origin / access errors must not unlock the accept checkbox.
        }
      },
      style: {
        border: 0,
        width: '100%',
        height: '100%',
        flex: 1,
        backgroundColor: '#fff',
        ...(style as object),
      },
    });
  }

  return (
    <WebView
      ref={webViewRef}
      originWhitelist={['*']}
      source={{ html: content }}
      style={[styles.webview, style]}
      scrollEnabled
      onMessage={handleMessage}
      injectedJavaScript={buildInjectedJs(generationRef.current)}
      onLoadEnd={() => {
        webViewRef.current?.injectJavaScript(
          buildInjectedJs(generationRef.current)
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: '#fff' },
});
