function sendStorageRequest(type, payload, onSuccess, onError) {
  try {
    chrome.runtime.sendMessage({ type, ...payload }, (response) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        onError(new Error(runtimeError.message));
        return;
      }
      if (!response?.ok) {
        onError(new Error(response?.error || "Falha ao acessar o armazenamento."));
        return;
      }
      onSuccess(response);
    });
  } catch (error) {
    onError(error);
  }
}

function getFromLocalStorage(keys) {
  const result = {};
  const requestedKeys =
    keys === null
      ? Object.keys(localStorage)
      : Array.isArray(keys)
        ? keys
        : [keys];

  requestedKeys.forEach((key) => {
    if (!key) return;
    const value = localStorage.getItem(key);
    if (value === null) return;
    try {
      result[key] = JSON.parse(value);
    } catch {
      result[key] = value;
    }
  });
  return result;
}

export const safeStorage = {
  get(keys, cb) {
    const done = (value, error = null) => {
      if (error) console.error("[SC Monitor] Falha ao ler armazenamento:", error);
      cb?.(value || {}, { ok: !error, error });
    };
    try {
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        sendStorageRequest(
          "SCM_STORAGE_GET",
          { keys: keys ?? null },
          (response) => done(response.data),
          (error) => done({}, error),
        );
      } else if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.get(keys, (result) => {
          const error = chrome.runtime?.lastError;
          done(result, error ? new Error(error.message) : null);
        });
      } else {
        done(getFromLocalStorage(keys));
      }
    } catch (error) {
      done({}, error);
    }
  },

  set(values, cb) {
    const done = (error = null) => {
      if (error) console.error("[SC Monitor] Falha ao gravar armazenamento:", error);
      cb?.({ ok: !error, error });
    };
    try {
      if (!values || typeof values !== "object" || Array.isArray(values)) {
        done(new TypeError("Os dados para gravação devem ser um objeto."));
        return;
      }
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        sendStorageRequest(
          "SCM_STORAGE_SET",
          { values },
          () => done(),
          done,
        );
      } else if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.set(values, () => {
          const error = chrome.runtime?.lastError;
          done(error ? new Error(error.message) : null);
        });
      } else {
        Object.entries(values).forEach(([key, value]) => {
          if (key) localStorage.setItem(key, JSON.stringify(value));
        });
        done();
      }
    } catch (error) {
      done(error);
    }
  },

  remove(keys, cb) {
    const done = (error = null) => {
      if (error) console.error("[SC Monitor] Falha ao remover armazenamento:", error);
      cb?.({ ok: !error, error });
    };
    try {
      if (!keys) {
        done();
        return;
      }
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        sendStorageRequest(
          "SCM_STORAGE_REMOVE",
          { keys },
          () => done(),
          done,
        );
      } else if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.local.remove(keys, () => {
          const error = chrome.runtime?.lastError;
          done(error ? new Error(error.message) : null);
        });
      } else {
        (Array.isArray(keys) ? keys : [keys]).forEach((key) => {
          if (key) localStorage.removeItem(key);
        });
        done();
      }
    } catch (error) {
      done(error);
    }
  },
};
