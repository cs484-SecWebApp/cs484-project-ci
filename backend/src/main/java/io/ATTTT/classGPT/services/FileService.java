package io.ATTTT.classGPT.services;

import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Service
public class FileService {

    private final Path root = Paths.get("./uploads");

    public FileService() {
        init();
    }

    private void init() {
        try {
            Files.createDirectories(root);
        } catch (IOException ex) {
            throw new RuntimeException("Could not initialize root folder", ex);
        }
    }

    public void save(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return; // nothing to save
        }

        try {
            Files.copy(file.getInputStream(), this.root.resolve(file.getOriginalFilename()));
        } catch (IOException ex) {
            throw new RuntimeException("Error saving file", ex);
        }
    }

    public Resource load(String filename) {
        if (filename == null) return null;
        try {
            Path file = root.resolve(filename);
            Resource resource = new UrlResource(file.toUri());

            if (resource.exists() && resource.isReadable()) {
                return resource;
            } else {
                throw new RuntimeException("Could not read the file!");
            }
        } catch (MalformedURLException mex) {
            throw new RuntimeException("Error: " + mex.getMessage(), mex);
        }
    }

    public Resource loadAsResource(String key) {
        // currently key == filename
        return load(key);
    }

    public String storeCourseFile(Long courseId, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }

        // for now, we just use the original filename as the key
        String storageKey = file.getOriginalFilename();

        Files.copy(file.getInputStream(), this.root.resolve(storageKey));
        return storageKey;
    }

    public void deleteFile(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) {
            return; // nothing to delete
        }

        try {
            Path file = root.resolve(storageKey);
            Files.deleteIfExists(file);
        } catch (IOException ex) {
            throw new RuntimeException("Error deleting file: " + storageKey, ex);
        }
    }
}
