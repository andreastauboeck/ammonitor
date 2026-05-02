#!/usr/bin/env Rscript

# ALFAM2 Model Runner
# Runs the ALFAM2 model for multiple variants (grouped) with time series inputs.
# Input: CSV file with columns: day_variant, ct, TAN.app, man.dm, man.ph, man.source,
#        app.mthd, incorp, t.incorp, app.rate, air.temp, wind.sqrt, rain.rate
# Output: CSV file with columns: day_variant, ct, e, er, j, jinst

args <- commandArgs(trailingOnly = TRUE)

if (length(args) < 2) {
  stop("Usage: Rscript run_alfam2.R <input.csv> <output.csv>")
}

input_file <- args[1]
output_file <- args[2]

suppressPackageStartupMessages(library(ALFAM2))

dat <- read.csv(input_file, stringsAsFactors = FALSE)

# Normalize incorp: treat empty / "none" as no incorporation
if ("incorp" %in% names(dat)) {
  dat$incorp[is.na(dat$incorp) | dat$incorp == "" | tolower(dat$incorp) == "none"] <- NA
}

# Determine if we need to pass time.incorp (only if any incorp is set)
has_incorp <- "incorp" %in% names(dat) && any(!is.na(dat$incorp))
time_incorp_arg <- if (has_incorp && "t.incorp" %in% names(dat)) "t.incorp" else NULL

tryCatch({
  pred <- alfam2(
    dat = dat,
    app.name = "TAN.app",
    time.name = "ct",
    time.incorp = time_incorp_arg,
    group = "day_variant",
    warn = FALSE,
    check = TRUE
  )

  # Keep only relevant columns
  keep_cols <- intersect(c("day_variant", "ct", "e", "er", "j", "jinst"), names(pred))
  out <- pred[, keep_cols]

  write.csv(out, output_file, row.names = FALSE)
  message(paste("ALFAM2 calculation complete. Output written to", output_file))

}, error = function(e) {
  message("Error running ALFAM2: ", e$message)
  write.csv(data.frame(error = e$message), output_file, row.names = FALSE)
  quit(status = 1)
})
