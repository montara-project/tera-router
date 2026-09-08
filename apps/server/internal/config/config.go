package config

type Config struct {
	App      ConfigApp
	Database ConfigDatabase
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
	URL string
}
