-- Per-attempt breakdown of the token savings. saving_rules maps each input
-- compression rule ("headroom" or an RTK rule such as "repeated_lines") to the
-- bytes it removed; output_directives lists the output-shaping directives that
-- were appended (caveman, terse, ponytail).
ALTER TABLE usage_records ADD COLUMN saving_rules TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(saving_rules));
ALTER TABLE usage_records ADD COLUMN output_directives TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(output_directives));
