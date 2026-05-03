/**
 * API Response envelope types
 * Matches the SiftMemory core daemon ApiResponse<T> contract
 */
export function isApiSuccess(response) {
    return response.ok === true && response.data != null;
}
export function isApiError(response) {
    return response.ok === false || response.error != null;
}
export function getApiError(response) {
    if (response.error) {
        return `${response.error.code}: ${response.error.message}`;
    }
    return 'Unknown API error';
}
//# sourceMappingURL=api-types.js.map