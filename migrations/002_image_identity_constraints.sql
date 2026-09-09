ALTER TABLE images
    ADD CONSTRAINT images_filename_unique
    UNIQUE (filename);
