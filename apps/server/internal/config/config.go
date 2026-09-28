package config

type Config struct {
	App      ConfigApp
	Database ConfigDatabase
	Sentry   ConfigSentry
}

type ConfigApp struct {
	Env                string
	Debug              bool
	Port               int
	MachineID          uint16
	Name               string
	Secret             string
	CORSAllowedOrigins string
}

type ConfigDatabase struct {
	// Path is the SQLite database file (default terarouter.db).
	Path string
	// MigrateOnBoot applies pending SQL migrations before the server starts.
	MigrateOnBoot bool
}

type ConfigSentry struct {
	Dsn string
}
