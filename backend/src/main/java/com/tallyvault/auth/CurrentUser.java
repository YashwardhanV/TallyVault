package com.tallyvault.auth;

import com.tallyvault.common.ApiException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class CurrentUser {
    private final UserRepository users;

    public CurrentUser(UserRepository users) { this.users = users; }

    public User require() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw ApiException.forbidden("authentication is required");
        }
        return users.findByEmailIgnoreCase(authentication.getName())
            .orElseThrow(() -> ApiException.forbidden("authenticated user no longer exists"));
    }
}
