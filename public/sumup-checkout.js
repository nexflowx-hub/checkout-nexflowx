/**
 * SumUp Checkout SDK Loader
 * ──────────────────────────
 * This script dynamically injects the official SumUp Card SDK into the page.
 * It provides a callback queue so callers can register mount callbacks even
 * before the SDK has finished loading.
 *
 * Official SDK: https://gateway.sumup.com/gateway/ecom/card/v1.2/js/sdk.js
 */
(function () {
  'use strict';

  // Prevent double-loading
  if (window.__sumupSdkLoading || window.SumUpCard) return;
  window.__sumupSdkLoading = true;

  // Callback queue for callers that want to be notified when SDK is ready
  window.__sumupCallbacks = window.__sumupCallbacks || [];

  var SDK_URL = 'https://gateway.sumup.com/gateway/ecom/card/v1.2/js/sdk.js';

  var script = document.createElement('script');
  script.id = 'sumup-official-sdk';
  script.src = SDK_URL;
  script.async = true;
  script.crossOrigin = 'anonymous';

  script.onload = function () {
    window.__sumupSdkReady = true;
    // Dispatch custom event
    if (typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('sumup-sdk-ready'));
    }
    // Flush callback queue
    var queue = window.__sumupCallbacks || [];
    for (var i = 0; i < queue.length; i++) {
      try {
        queue[i]();
      } catch (e) {
        console.error('[SumUpLoader] Callback error:', e);
      }
    }
    window.__sumupCallbacks = [];
  };

  script.onerror = function () {
    window.__sumupSdkError = true;
    if (typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('sumup-sdk-error'));
    }
    // Flush callbacks with error indication
    var queue = window.__sumupCallbacks || [];
    for (var i = 0; i < queue.length; i++) {
      try {
        queue[i](new Error('Failed to load SumUp SDK'));
      } catch (e) {
        console.error('[SumUpLoader] Callback error:', e);
      }
    }
    window.__sumupCallbacks = [];
  };

  document.head.appendChild(script);
})();
