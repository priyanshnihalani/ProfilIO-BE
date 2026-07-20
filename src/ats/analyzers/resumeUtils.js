/**
 * Safely converts any resume field value to a plain lowercase string.
 * Handles: string, array of strings, array of objects, null/undefined.
 * 
 * @param {*} value - Any resume field value
 * @returns {string} Normalized lowercase string
 */
export const toText = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
        return value.map(item => {
            if (!item) return "";
            if (typeof item === "string") return item;
            if (typeof item === "object") {
                // Flatten all string values from the object
                return Object.values(item)
                    .filter(v => typeof v === "string" || typeof v === "number")
                    .join(" ");
            }
            return String(item);
        }).join(" ");
    }
    if (typeof value === "object") {
        return Object.values(value)
            .filter(v => typeof v === "string" || typeof v === "number")
            .join(" ");
    }
    return String(value);
};

/**
 * Safely checks whether a resume field is empty/missing.
 * 
 * @param {*} value - Any resume field value
 * @returns {boolean}
 */
export const isEmpty = (value) => {
    if (!value) return true;
    if (typeof value === "string") return value.trim() === "";
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "object") return Object.keys(value).length === 0;
    return false;
};
