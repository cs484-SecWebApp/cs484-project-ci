package io.ATTTT.classGPT.services;

import io.ATTTT.classGPT.models.Account;
import io.ATTTT.classGPT.models.Post;
import io.ATTTT.classGPT.repositories.PostRepository;
import io.ATTTT.classGPT.services.AccountService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;


import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class PostService {


    @Autowired
    private PostRepository postRepository;

    public Optional<Post> getById(Long id){
        return postRepository.findById(id);
    }

    public List<Post> getAll(){
        return postRepository.findAll();
    }

    public List<Post> getPostsForCourse(Long courseId) {
        return postRepository.findByCourseIdOrderByCreatedAtDesc(courseId);
    }

    public Post save(Post post){
        if (post.getId() == null) {
            // only when creating
            post.setCreatedAt(LocalDateTime.now());
        }

        post.setModifiedAt(LocalDateTime.now());
        return postRepository.save(post);
    }


    public void delete(Post post) {
        postRepository.delete(post);
    }

}
