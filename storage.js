class Storage {

    set(key, value) {
        localStorage.setItem(key, JSON.stringify(value))
    }

    get(key) {
        return JSON.parse(localStorage.getItem(key))
    }

    has(key) {
        return localStorage.getItem(key) !== null && localStorage.getItem(key) !== undefined;
    }

    delete(key) {
        localStorage.removeItem(key)
    }

    forget(key) {
        this.delete(key)
    }

    clear() {
        localStorage.clear()
    }

    setIfNull(key, value) {
        if (this.has(key)) {
            return this.get(key);
        }
        this.set(key, value);
        return value;
    }
}

export default new Storage();