import { getStoredAccessToken } from './token-storage'

export const getAccessToken = async () => {
  return getStoredAccessToken()
}
