export type SourceCodeFilterMode = 'off' | 'minimal' | 'aggressive'

export type AppSettings = {
  rtkEnabled: boolean
  sourceCodeFilter: SourceCodeFilterMode
  cavemanEnabled: boolean
  terseEnabled: boolean
  headroomEnabled: boolean
  ponytailEnabled: boolean
}
